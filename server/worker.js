// Качалка FocusOS. Работает на Маке (или любом домашнем компьютере).
// Берёт из Supabase треки со статусом «queued», скачивает звук и обложку через yt-dlp,
// загружает их в Storage и ставит статус «ready». Новые ссылки ловит мгновенно (Realtime),
// плюс на всякий случай проверяет очередь раз в 30 секунд.
//
// Запуск: npm run worker
// Нужно: brew install yt-dlp ffmpeg  и файл server/.env:
//   SUPABASE_URL=https://....supabase.co
//   SUPABASE_SECRET_KEY=sb_secret_...   (Project Settings -> API Keys -> Secret key)

import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const BUCKET = 'media'
const MAX_BYTES = (Number(process.env.MAX_MB) || 45) * 1024 * 1024 // бесплатный Supabase принимает файлы до 50 МБ — оставляем запас
const YTDLP = process.env.YTDLP_BIN || 'yt-dlp'
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const COOKIES_BROWSER = process.env.COOKIES_BROWSER // если YouTube просит «подтвердить, что не бот»: safari / chrome

const log = (...a) => console.log(new Date().toLocaleTimeString('ru-RU'), ...a)

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args)
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', (e) => reject(new Error(e.code === 'ENOENT' ? `${cmd} не найден. Установи: brew install yt-dlp ffmpeg` : e.message)))
    p.on('close', (code) => {
      if (code === 0) return resolve(out)
      const line = err.split('\n').reverse().find((l) => l.includes('ERROR')) || err.trim().split('\n').pop()
      // «ERROR: [youtube] abc123: Video unavailable» -> «Video unavailable»
      const clean = line?.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?([\w-]{11}:\s*)?/, '')
      reject(new Error(clean || `${cmd} завершился с кодом ${code}`))
    })
  })
}

// Скачать звук (m4a) и обложку (jpg) в папку dir. Возвращает информацию о видео.
async function download(youtubeId, dir) {
  const args = [
    '--no-playlist', '--no-progress',
    '-f', 'bestaudio[ext=m4a]/bestaudio',
    '-x', '--audio-format', 'm4a',
    '--write-thumbnail', '--convert-thumbnails', 'jpg',
    '-o', path.join(dir, 'audio.%(ext)s'),
    '-o', 'thumbnail:' + path.join(dir, 'cover.%(ext)s'),
    '--dump-json', '--no-simulate',
  ]
  if (COOKIES_BROWSER) args.push('--cookies-from-browser', COOKIES_BROWSER)
  args.push(`https://www.youtube.com/watch?v=${youtubeId}`)
  const out = await run(YTDLP, args)
  const json = out.trim().split('\n').reverse().find((l) => l.startsWith('{'))
  return json ? JSON.parse(json) : {}
}

// Если файл больше лимита — пережимаем AAC с битрейтом, при котором он влезет
async function fitSize(file, duration) {
  const size = (await stat(file)).size
  if (size <= MAX_BYTES) return file
  const kbps = Math.max(32, Math.min(128, Math.floor((MAX_BYTES * 8) / 1000 / Math.max(duration, 1) * 0.95)))
  log(`  файл ${(size / 1048576).toFixed(1)} МБ > лимита, пережимаю в ${kbps} kbps`)
  const out = file.replace(/\.m4a$/, '.small.m4a')
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', file, '-vn', '-c:a', 'aac', '-b:a', `${kbps}k`, '-movflags', '+faststart', out])
  return out
}

export async function processJob(sb, job) {
  log(`↓ ${job.source_url}`)
  const dir = await mkdtemp(path.join(tmpdir(), 'focusos-'))
  try {
    const info = await download(job.youtube_id, dir)
    const files = await readdir(dir)
    const audioName = files.find((f) => f.startsWith('audio.') && f.endsWith('.m4a'))
    const coverName = files.find((f) => f.startsWith('cover.'))
    if (!audioName) throw new Error('Звук не скачался')
    const duration = Math.round(info.duration || 0)
    const audioFile = await fitSize(path.join(dir, audioName), duration)

    const base = `${job.user_id}/${job.youtube_id}`
    const up = async (name, file, contentType) => {
      const { error } = await sb.storage.from(BUCKET).upload(name, await readFile(file), { contentType, upsert: true })
      if (error) throw new Error(`Загрузка в Storage: ${error.message}`)
      return name
    }
    const audio_path = await up(`${base}.m4a`, audioFile, 'audio/mp4')
    const cover_path = coverName ? await up(`${base}.jpg`, path.join(dir, coverName), 'image/jpeg') : null

    const patch = {
      status: 'ready',
      error: null,
      author: info.uploader || info.channel || null,
      duration,
      audio_path,
      cover_path,
    }
    if (!job.title) patch.title = info.title || null // если трек уже переименовали — название не трогаем
    const { error } = await sb.from('tracks').update(patch).eq('id', job.id)
    if (error) throw error
    log(`✓ ${info.title} (${(((await stat(audioFile)).size) / 1048576).toFixed(1)} МБ)`)
  } catch (e) {
    log(`✗ ${e.message}`)
    await sb.from('tracks').update({ status: 'error', error: String(e.message).slice(0, 300) }).eq('id', job.id)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// Взять следующую ссылку из очереди. Статус меняем только если он всё ещё «queued»,
// чтобы два запущенных воркера не скачивали одно и то же.
export async function claimNext(sb) {
  const { data, error } = await sb.from('tracks').select('*').eq('status', 'queued').order('created_at', { ascending: true }).limit(1)
  if (error) throw error
  if (!data?.length) return null
  const { data: taken, error: e2 } = await sb.from('tracks').update({ status: 'downloading', error: null }).eq('id', data[0].id).eq('status', 'queued').select()
  if (e2) throw e2
  return taken?.[0] ?? (await claimNext(sb)) // кто-то успел раньше — берём следующий
}

export function createWorker(sb) {
  let busy = false
  let again = false
  const tick = async () => {
    if (busy) { again = true; return }
    busy = true
    try {
      do {
        again = false
        let job
        while ((job = await claimNext(sb))) await processJob(sb, job)
      } while (again)
    } catch (e) {
      log('ошибка очереди:', e.message)
    } finally {
      busy = false
    }
  }
  return { tick }
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('Нет SUPABASE_URL или SUPABASE_SECRET_KEY. Создай файл server/.env (см. начало server/worker.js)')
    process.exit(1)
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

  // Если качалку закрыли посреди скачивания — вернуть такие треки в очередь
  await sb.from('tracks').update({ status: 'queued' }).eq('status', 'downloading')

  const w = createWorker(sb)
  sb.channel('worker')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracks' }, () => w.tick())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tracks', filter: 'status=eq.queued' }, () => w.tick())
    .subscribe((status) => status === 'SUBSCRIBED' && log('слушаю новые ссылки…'))
  setInterval(() => w.tick(), 30_000)
  log('FocusOS worker запущен')
  w.tick()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()

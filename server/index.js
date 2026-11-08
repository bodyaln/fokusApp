// Мини-сервер FocusOS: скачивает звук и обложку с YouTube через yt-dlp и отдаёт их приложению.
// Запуск: npm run server   (нужны yt-dlp и ffmpeg: brew install yt-dlp ffmpeg)
//
// POST /api/tracks  { url }  -> скачивает и возвращает { id, title, author, duration, cover, url }
// GET  /api/tracks           -> все скачанные треки
// DELETE /api/tracks/:id     -> удалить трек и его файлы
// GET  /media/<файл>         -> аудио и обложки (с поддержкой перемотки через Range)

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT) || 8787
const ROOT = path.dirname(fileURLToPath(import.meta.url))
const MEDIA = path.join(ROOT, 'media')
const DB = path.join(MEDIA, 'library.json')
const YTDLP = process.env.YTDLP_BIN || 'yt-dlp'
// Если YouTube просит подтвердить, что ты не бот: COOKIES_BROWSER=safari npm run server
const COOKIES_BROWSER = process.env.COOKIES_BROWSER

const YT_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i

await mkdir(MEDIA, { recursive: true })

// ---------- библиотека (простой JSON-файл) ----------
async function loadDb() {
  try { return JSON.parse(await readFile(DB, 'utf8')) } catch { return [] }
}
async function saveDb(list) {
  await writeFile(DB, JSON.stringify(list, null, 2))
}

// ---------- скачивание ----------
const inProgress = new Map() // id -> Promise, чтобы одну ссылку не качать дважды одновременно

function runYtDlp(url) {
  const args = [
    '--no-playlist',
    '--no-progress',
    '-f', 'bestaudio[ext=m4a]/bestaudio', // m4a (AAC) играет везде, включая Safari на iPhone
    '-x', '--audio-format', 'm4a',
    '--write-thumbnail', '--convert-thumbnails', 'jpg',
    '-o', path.join(MEDIA, '%(id)s.%(ext)s'),
    '-o', 'thumbnail:' + path.join(MEDIA, '%(id)s.%(ext)s'),
    '--dump-json', '--no-simulate', // скачать и вывести информацию о видео в JSON
  ]
  if (COOKIES_BROWSER) args.push('--cookies-from-browser', COOKIES_BROWSER)
  args.push(url)

  return new Promise((resolve, reject) => {
    const p = spawn(YTDLP, args)
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', (e) =>
      reject(new Error(e.code === 'ENOENT' ? 'yt-dlp не найден. Установи: brew install yt-dlp ffmpeg' : e.message)),
    )
    p.on('close', (code) => {
      if (code !== 0) {
        const line = err.split('\n').reverse().find((l) => l.includes('ERROR')) || err.trim().split('\n').pop()
        return reject(new Error(line || `yt-dlp завершился с кодом ${code}`))
      }
      const json = out.trim().split('\n').reverse().find((l) => l.startsWith('{'))
      try { resolve(JSON.parse(json)) } catch { reject(new Error('Не удалось прочитать ответ yt-dlp')) }
    })
  })
}

async function addTrack(url) {
  const id = url.match(YT_ID)?.[1]
  if (!id) throw Object.assign(new Error('Это не ссылка на видео YouTube'), { status: 400 })

  const db = await loadDb()
  const existing = db.find((t) => t.id === id)
  if (existing) return existing

  if (!inProgress.has(id)) {
    inProgress.set(id, (async () => {
      const info = await runYtDlp(`https://www.youtube.com/watch?v=${id}`)
      const files = await readdir(MEDIA)
      const audio = files.find((f) => f.startsWith(id + '.') && f.endsWith('.m4a'))
      const thumb = files.find((f) => f.startsWith(id + '.') && /\.(jpg|jpeg|png|webp)$/.test(f))
      if (!audio) throw new Error('Звук не скачался')
      const track = {
        id,
        title: info.title || id,
        author: info.uploader || info.channel || '',
        duration: Math.round(info.duration || 0),
        cover: thumb ? `/media/${thumb}` : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `/media/${audio}`,
        source: `https://youtu.be/${id}`,
        addedAt: Date.now(),
      }
      const fresh = await loadDb()
      await saveDb([track, ...fresh.filter((t) => t.id !== id)])
      return track
    })().finally(() => inProgress.delete(id)))
  }
  return inProgress.get(id)
}

async function removeTrack(id) {
  const db = await loadDb()
  await saveDb(db.filter((t) => t.id !== id))
  for (const f of await readdir(MEDIA)) {
    if (f.startsWith(id + '.')) await unlink(path.join(MEDIA, f)).catch(() => {})
  }
}

// ---------- раздача файлов с поддержкой Range (нужно для перемотки) ----------
const TYPES = { '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

async function serveMedia(req, res, name) {
  const file = path.join(MEDIA, path.basename(decodeURIComponent(name))) // basename: никаких ../
  let info
  try { info = await stat(file) } catch { return send(res, 404, { error: 'Файл не найден' }) }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/)
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${info.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    })
    createReadStream(file, { start, end }).pipe(res)
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Accept-Ranges': 'bytes' })
    createReadStream(file).pipe(res)
  }
}

// ---------- HTTP ----------
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

async function readBody(req) {
  let body = ''
  for await (const chunk of req) body += chunk
  try { return JSON.parse(body || '{}') } catch { return {} }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x')
  try {
    if (pathname.startsWith('/media/')) return await serveMedia(req, res, pathname.slice(7))

    if (pathname === '/api/tracks' && req.method === 'GET') return send(res, 200, await loadDb())

    if (pathname === '/api/tracks' && req.method === 'POST') {
      const { url } = await readBody(req)
      console.log('↓ скачиваю', url)
      const t0 = Date.now()
      const track = await addTrack(String(url || ''))
      console.log(`✓ ${track.title} (${((Date.now() - t0) / 1000).toFixed(1)} с)`)
      return send(res, 200, track)
    }

    const del = pathname.match(/^\/api\/tracks\/([\w-]{11})$/)
    if (del && req.method === 'DELETE') {
      await removeTrack(del[1])
      return send(res, 200, { ok: true })
    }

    send(res, 404, { error: 'Не найдено' })
  } catch (e) {
    console.error('✗', e.message)
    send(res, e.status || 500, { error: e.message })
  }
}).listen(PORT, () => console.log(`FocusOS server: http://localhost:${PORT}`))

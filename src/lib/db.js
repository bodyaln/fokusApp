// Вся работа с Supabase в одном месте. Остальной код вызывает только эти функции.
import { supabase } from './supabase'

// ---------- вход ----------
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session))
  return () => data.subscription.unsubscribe()
}
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data.session // null, если в Supabase включено подтверждение почты
}
export async function signOut() {
  await supabase.auth.signOut()
}

// ---------- треки ----------
export async function listTracks() {
  const { data, error } = await supabase.from('tracks').select('*').order('position', { ascending: true })
  if (error) throw error
  return data
}

export async function insertTrack(row) {
  const { data, error } = await supabase.from('tracks').insert(row).select().single()
  if (error) {
    if (error.code === '23505') throw new Error('Этот трек уже в списке')
    throw error
  }
  return data
}

export async function updateTrack(id, patch) {
  const { error } = await supabase.from('tracks').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTrack(row) {
  const files = [row.audio_path, row.cover_path].filter(Boolean)
  if (files.length) await media('delete', files).catch((e) => console.warn('[db] файлы не удалились', e))
  const { error } = await supabase.from('tracks').delete().eq('id', row.id)
  if (error) throw error
}

// Любое изменение в таблице треков (с любого устройства или от качалки) -> cb()
export function subscribeTracks(cb) {
  const ch = supabase
    .channel('tracks-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks' }, cb)
    .subscribe()
  return () => supabase.removeChannel(ch)
}

// Файлы лежат в приватном Cloudflare R2. Ссылки на них выдаёт наша функция /api/media на Vercel:
// она проверяет, что ты вошёл, и подписывает только твои файлы.
async function media(action, paths) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ action, paths }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Ошибка /api/media (${res.status})`)
  return json
}

// Временные ссылки на файлы (аудио, обложки), действуют 24 часа. paths -> { path: url }
export async function signUrls(paths) {
  if (!paths.length) return {}
  return (await media('sign', paths)).urls
}

// ---------- занятое место ----------
// r2: файлы в Cloudflare R2 (только твоя папка), db: размер базы Supabase.
// Размер базы отдаёт SQL-функция storage_usage() — если её ещё не создали, вернётся null.
export async function getUsage() {
  const [r2, db] = await Promise.allSettled([
    media('usage', []),
    supabase.rpc('storage_usage'),
  ])
  return {
    r2Bytes: r2.status === 'fulfilled' ? r2.value.bytes : null,
    r2Files: r2.status === 'fulfilled' ? r2.value.files : null,
    dbBytes: db.status === 'fulfilled' && !db.value.error ? Number(db.value.data?.db_bytes) : null,
  }
}

// ---------- сессии таймера ----------
export async function listSessions(sinceMs) {
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('started_at, ms, mode')
    .gte('started_at', new Date(sinceMs).toISOString())
  if (error) throw error
  return data.map((s) => ({ start: new Date(s.started_at).getTime(), ms: s.ms, mode: s.mode }))
}

export async function insertSession(s) {
  const { error } = await supabase
    .from('focus_sessions')
    .insert({ started_at: new Date(s.start).toISOString(), ms: Math.round(s.ms), mode: s.mode })
  if (error) throw error
}

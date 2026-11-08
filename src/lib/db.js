// Вся работа с Supabase в одном месте. Остальной код вызывает только эти функции.
import { supabase } from './supabase'

const BUCKET = 'media'

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
  if (files.length) await supabase.storage.from(BUCKET).remove(files)
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

// Временные ссылки на приватные файлы (аудио, обложки). paths -> { path: url }
export async function signUrls(paths, seconds = 60 * 60 * 24) {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, seconds)
  if (error) throw error
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
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

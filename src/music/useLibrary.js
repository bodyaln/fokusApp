import { useCallback, useEffect, useRef, useState } from 'react'
import * as db from '../lib/db'

export const YT_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i
export const youtubeId = (url) => url.match(YT_ID)?.[1] ?? null
const thumb = (yid) => `https://i.ytimg.com/vi/${yid}/mqdefault.jpg`

// Библиотека треков из Supabase.
// rows — все строки (и готовые, и в очереди), в порядке position.
// Каждая строка дополнена полями для плеера: url (временная ссылка на аудио) и cover.
export function useLibrary(enabled) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const urlCache = useRef({}) // path -> подписанная ссылка, чтобы не переподписывать каждый раз

  const refresh = useCallback(async () => {
    try {
      const list = await db.listTracks()
      const need = list.flatMap((r) => [r.audio_path, r.cover_path]).filter((p) => p && !urlCache.current[p])
      if (need.length) Object.assign(urlCache.current, await db.signUrls(need))
      setRows(list.map((r) => ({
        ...r,
        url: r.audio_path ? urlCache.current[r.audio_path] : null,
        cover: (r.cover_path && urlCache.current[r.cover_path]) || thumb(r.youtube_id),
      })))
      setError('')
    } catch (e) {
      setError(e.message || 'Не удалось загрузить список')
    } finally {
      setLoading(false)
    }
  }, [])

  // Первая загрузка + живые обновления (другое устройство, качалка на Маке)
  useEffect(() => {
    if (!enabled) return
    refresh()
    let t
    const unsub = db.subscribeTracks(() => {
      clearTimeout(t)
      t = setTimeout(refresh, 250) // несколько изменений подряд -> одна перезагрузка
    })
    // вернулся в приложение (телефон проснулся) -> подтянуть свежий список
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => { unsub(); clearTimeout(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [enabled, refresh])

  // ---------- действия ----------
  const add = useCallback(async (url) => {
    const yid = youtubeId(url)
    if (!yid) throw new Error('Это не ссылка на видео YouTube')
    if (rows.some((r) => r.youtube_id === yid)) throw new Error('Этот трек уже в списке')
    const top = rows.length ? rows[0].position - 1 : Date.now() / 1000
    const row = await db.insertTrack({ youtube_id: yid, source_url: `https://youtu.be/${yid}`, position: top })
    setRows((list) => [{ ...row, url: null, cover: thumb(yid) }, ...list.filter((r) => r.id !== row.id)])
  }, [rows])

  const remove = useCallback(async (id) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    setRows((list) => list.filter((r) => r.id !== id))
    try { await db.deleteTrack(row) } catch (e) { setError(e.message); refresh() }
  }, [rows, refresh])

  const rename = useCallback(async (id, title) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, title } : r)))
    try { await db.updateTrack(id, { title }) } catch (e) { setError(e.message); refresh() }
  }, [refresh])

  // Переместить fromId на место toId. Меняем position только у одного трека:
  // ставим его между новыми соседями.
  const reorder = useCallback(async (fromId, toId) => {
    const from = rows.findIndex((r) => r.id === fromId)
    const to = rows.findIndex((r) => r.id === toId)
    if (from < 0 || to < 0 || from === to) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const before = next[to - 1]?.position
    const after = next[to + 1]?.position
    const position = before == null ? after - 1 : after == null ? before + 1 : (before + after) / 2
    next[to] = { ...moved, position }
    setRows(next)
    try { await db.updateTrack(fromId, { position }) } catch (e) { setError(e.message); refresh() }
  }, [rows, refresh])

  const retry = useCallback(async (id) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, status: 'queued', error: null } : r)))
    try { await db.updateTrack(id, { status: 'queued', error: null }) } catch (e) { setError(e.message); refresh() }
  }, [refresh])

  return { rows, loading, error, add, remove, rename, reorder, retry }
}

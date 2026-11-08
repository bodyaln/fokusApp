// Запросы к нашему серверу (server/index.js). В dev Vite проксирует /api и /media на localhost:8787

export const YT_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i
export const youtubeId = (url) => url.match(YT_ID)?.[1] ?? null

async function request(path, options) {
  let res
  try {
    res = await fetch(path, options)
  } catch {
    throw new Error('Сервер не отвечает. Запусти его: npm run server')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 502 || res.status === 504) throw new Error('Сервер не запущен. Открой второй терминал: npm run server')
    throw new Error(data.error || `Ошибка сервера (${res.status})`)
  }
  return data
}

export const fetchTracks = () => request('/api/tracks')

export const downloadTrack = (url) =>
  request('/api/tracks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

export const deleteTrackOnServer = (id) => request(`/api/tracks/${id}`, { method: 'DELETE' })

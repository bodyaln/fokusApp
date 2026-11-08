import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePlayer } from './player/usePlayer'
import FocusScreen from './focus/FocusScreen'
import MusicScreen from './music/MusicScreen'
import FullPlayer from './music/FullPlayer'
import { useFocusTimer } from './focus/useFocusTimer'
import { MiniPlayer, BottomNav } from './layout/Shell'
import { demoTracks } from './tracks'
import { deleteTrackOnServer, downloadTrack, fetchTracks, youtubeId } from './music/api'

const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f } catch { return f } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export default function App() {
  const [tab, setTab] = useState(() => load('ui:tab', 'focus'))
  const [playerOpen, setPlayerOpen] = useState(false)
  const closePlayer = useCallback(() => setPlayerOpen(false), [])
  // Библиотека треков. Хранится в браузере; скачанные треки дополнительно лежат на сервере
  const [tracks, setTracks] = useState(() => load('tracks', demoTracks))
  useEffect(() => save('tracks', tracks), [tracks])

  // При запуске подтягиваем с сервера треки, которых ещё нет в списке (например, скачанные с другого устройства)
  useEffect(() => {
    fetchTracks()
      .then((server) => setTracks((list) => {
        const have = new Set(list.map((t) => t.id))
        const extra = server.filter((t) => !have.has(t.id))
        return extra.length ? [...extra, ...list] : list
      }))
      .catch(() => {}) // сервер не запущен: просто работаем с тем, что есть
  }, [])

  // Треки, которые сейчас качаются: показываем их в списке с крутилкой
  const [pending, setPending] = useState([])

  const addTrack = async (url) => {
    const id = youtubeId(url)
    if (tracks.some((t) => t.id === id)) throw new Error('Этот трек уже в списке')
    if (pending.some((t) => t.id === id)) throw new Error('Этот трек уже скачивается')
    setPending((list) => [{ id, url, cover: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` }, ...list])
    try {
      const track = await downloadTrack(url)
      setTracks((list) => [track, ...list.filter((t) => t.id !== track.id)])
    } finally {
      setPending((list) => list.filter((t) => t.id !== id))
    }
  }

  const deleteTrack = (id) => {
    const t = tracks.find((x) => x.id === id)
    setTracks((list) => list.filter((x) => x.id !== id))
    if (t?.source) deleteTrackOnServer(id).catch(() => {}) // скачанный — удаляем и файлы на сервере
  }
  // Переместить трек fromId на место трека toId (перетаскивание в списке)
  const reorderTrack = (fromId, toId) => setTracks((list) => {
    const from = list.findIndex((t) => t.id === fromId)
    const to = list.findIndex((t) => t.id === toId)
    if (from < 0 || to < 0 || from === to) return list
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  })
  const renameTrack = (id, title) => setTracks((list) => list.map((t) => (t.id === id ? { ...t, title } : t)))

  useEffect(() => save('ui:tab', tab), [tab])

  // очередь воспроизведения = весь список
  const queue = tracks

  // Высота нижней панели (мини-плеер + навигация) -> CSS-переменная --dock-h,
  // чтобы карточка сверху растягивалась ровно до неё
  const dockRef = useRef(null)
  useEffect(() => {
    const el = dockRef.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--dock-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const p = usePlayer(queue)
  // Таймер вышел — музыка останавливается и возвращается в начало трека
  const timer = useFocusTimer({ onComplete: () => { p.pause(); p.seek(0) } })

  // ---- Связка музыки и таймера ----
  // Кнопки таймера управляют и музыкой
  const t = useMemo(() => ({
    ...timer,
    start: () => { timer.start(); p.play() },
    pause: () => { timer.pause(); p.pause() },
    resume: () => { timer.resume(); p.play() },
    finish: () => { timer.finish(); p.pause() },
    reset: () => { timer.reset(); p.pause() },
  }), [timer, p])

  // А музыка управляет таймером: заиграла — таймер идёт, остановилась — таймер на паузе.
  // Таймер считает настоящее время, перемотка трека на него не влияет.
  const timerRef = useRef(timer)
  timerRef.current = timer
  const wasPlaying = useRef(p.playing)
  useEffect(() => {
    const prev = wasPlaying.current
    wasPlaying.current = p.playing
    const tm = timerRef.current
    if (p.playing) {
      if (tm.status === 'idle') tm.start()
      else if (tm.status === 'paused') tm.resume()
      return
    }
    if (!prev) return // реагируем только когда музыка именно остановилась
    // при переключении трека звук на долю секунды «останавливается» — ждём, прежде чем ставить паузу
    const id = setTimeout(() => {
      if (!wasPlaying.current && timerRef.current.status === 'running') timerRef.current.pause()
    }, 400)
    return () => clearTimeout(id)
  }, [p.playing])

  return (
    <>
      <main className="screen screen--fit">
        {tab === 'focus' && <FocusScreen t={t} />}
        {tab === 'music' && <MusicScreen tracks={queue} pending={pending} onAdd={addTrack} p={p} onDelete={deleteTrack} onRename={renameTrack} onReorder={reorderTrack} onOpenPlayer={() => setPlayerOpen(true)} />}
      </main>
      <div className="dock" ref={dockRef}>
        <div className="dock__inner">
          {/* мини-плеер на обеих вкладках: показывает трек, который сейчас выбран */}
          <MiniPlayer p={p} onOpen={() => setPlayerOpen(true)} />
          <BottomNav tab={tab} onTab={setTab} />
        </div>
      </div>
      <FullPlayer open={playerOpen} p={p} onClose={closePlayer} />
    </>
  )
}

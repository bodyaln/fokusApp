import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePlayer } from './player/usePlayer'
import FocusScreen from './focus/FocusScreen'
import MusicScreen from './music/MusicScreen'
import FullPlayer from './music/FullPlayer'
import { useFocusTimer } from './focus/useFocusTimer'
import { MiniPlayer, BottomNav } from './layout/Shell'
import AuthScreen from './auth/AuthScreen'
import { useLibrary } from './music/useLibrary'
import * as db from './lib/db'

const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f } catch { return f } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

const remoteSessions = {
  load: () => db.listSessions(Date.now() - 8 * 86400000),
  save: db.insertSession,
}

// Сначала проверяем вход. Без аккаунта — экран входа, с аккаунтом — приложение.
export default function App() {
  const [session, setSession] = useState(undefined) // undefined = ещё проверяем
  useEffect(() => {
    db.getSession().then(setSession)
    return db.onAuthChange(setSession)
  }, [])
  if (session === undefined) return null
  if (!session) return <AuthScreen />
  return <Main key={session.user.id} />
}

function Main() {
  const [tab, setTab] = useState(() => load('ui:tab', 'focus'))
  const [playerOpen, setPlayerOpen] = useState(false)
  const closePlayer = useCallback(() => setPlayerOpen(false), [])

  // Плейлист из Supabase: один и тот же на всех устройствах
  const lib = useLibrary(true)

  useEffect(() => save('ui:tab', tab), [tab])

  // Играть можно только скачанные треки
  const queue = useMemo(
    () => lib.rows
      .filter((r) => r.status === 'ready' && r.url)
      .map((r) => ({ id: r.id, title: r.title || 'Без названия', author: r.author, duration: r.duration, cover: r.cover, url: r.url })),
    [lib.rows],
  )

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
  const timer = useFocusTimer({
    onComplete: () => { p.pause(); p.seek(0) },
    // статистика таймера хранится в Supabase, чтобы «сегодня/за неделю» совпадали на всех устройствах
    remote: remoteSessions,
  })

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
        {tab === 'music' && <MusicScreen lib={lib} p={p} onOpenPlayer={() => setPlayerOpen(true)} />}
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

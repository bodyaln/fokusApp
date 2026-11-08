import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const MODES = [
  { id: 'stopwatch', label: 'Секундомер', minutes: 0 },
  { id: 't15', label: '15 мин', minutes: 15 },
  { id: 't30', label: '30 мин', minutes: 30 },
  { id: 't60', label: '1 час', minutes: 60 },
  { id: 't120', label: '2 часа', minutes: 120 },
  { id: 't180', label: '3 часа', minutes: 180 },
]

const STATE_KEY = 'focus:state'
const SESSIONS_KEY = 'focus:sessions'

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback } catch { return fallback }
}
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch {}
}

const initial = { modeId: 'stopwatch', status: 'idle', startedAt: null, accumulated: 0, sessionStart: null }

// Время считается от отметки startedAt, а не счётчиком секунд.
// Поэтому если закрыть Mini App и открыть через час, таймер покажет правильное время.
// remote (необязательно): { load(): Promise<sessions>, save(session): Promise } — хранение сессий на сервере
export function useFocusTimer({ onComplete, remote } = {}) {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const remoteRef = useRef(remote)
  remoteRef.current = remote
  const recorded = useRef(new Set()) // старты сессий, уже записанные в этом запуске приложения
  const [state, setState] = useState(() => {
    const s = read(STATE_KEY, initial)
    return MODES.some((m) => m.id === s.modeId) ? s : { ...s, modeId: initial.modeId }
  })
  // Завершённые сессии: { start, ms, mode }. Сюда попадают только запуски,
  // которые закончились сами или кнопкой «Завершить». «Сбросить» ничего не сохраняет.
  const [sessions, setSessions] = useState(() => read(SESSIONS_KEY, []))
  const [now, setNow] = useState(Date.now())

  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => write(STATE_KEY, state), [state])
  useEffect(() => write(SESSIONS_KEY, sessions), [sessions])

  // Сессии с сервера: на всех устройствах одинаковая статистика
  useEffect(() => {
    const r = remoteRef.current
    if (!r) return
    r.load()
      .then((list) => setSessions((local) => {
        const have = new Set(list.map((x) => x.start))
        // плюс то, что записали только что и сервер ещё не вернул
        const fresh = local.filter((x) => recorded.current.has(x.start) && !have.has(x.start))
        return [...list, ...fresh]
      }))
      .catch((e) => console.warn('[timer] не удалось загрузить сессии', e))
  }, [])

  useEffect(() => {
    if (state.status !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [state.status])

  const mode = MODES.find((m) => m.id === state.modeId) ?? MODES[0]
  const targetMs = mode.minutes * 60 * 1000 // 0 = секундомер
  const raw = state.accumulated + (state.status === 'running' ? now - state.startedAt : 0)
  const elapsed = targetMs ? Math.min(raw, targetMs) : raw

  // Одна сессия = один запуск. Если запуск с таким временем старта уже записан,
  // второй раз не добавляем (защита от двойного вызова)
  const record = useCallback((ms, s) => {
    const start = s.sessionStart ?? Date.now() - ms
    if (recorded.current.has(start)) return
    recorded.current.add(start)
    const session = { start, ms, mode: s.modeId }
    setSessions((list) =>
      list.some((x) => x.start === start) ? list : [...list, session].slice(-1000),
    )
    remoteRef.current?.save(session).catch((e) => console.warn('[timer] не удалось сохранить сессию', e))
  }, [])

  const start = useCallback(() => {
    const t = Date.now()
    setNow(t)
    setState((s) => ({ ...s, status: 'running', startedAt: t, accumulated: 0, sessionStart: t }))
  }, [])

  const pause = useCallback(() => {
    const t = Date.now()
    setState((s) => (s.status !== 'running' ? s : { ...s, status: 'paused', accumulated: s.accumulated + (t - s.startedAt), startedAt: null }))
  }, [])

  const resume = useCallback(() => {
    const t = Date.now()
    setNow(t)
    setState((s) => (s.status !== 'paused' ? s : { ...s, status: 'running', startedAt: t }))
  }, [])

  // Сохранить сессию и остановить.
  // record() нельзя вызывать внутри setState((s) => ...): в режиме разработки React
  // (StrictMode) запускает такую функцию дважды, и сессия записывалась два раза.
  // Поэтому берём текущее состояние из ref и вызываем record() один раз снаружи.
  const finish = useCallback(() => {
    const s = stateRef.current
    if (s.status === 'idle') return
    const ms = s.accumulated + (s.status === 'running' ? Date.now() - s.startedAt : 0)
    record(ms, s)
    setState({ ...initial, modeId: s.modeId })
  }, [record])

  // Отменить без сохранения
  const reset = useCallback(() => {
    setState((s) => ({ ...initial, modeId: s.modeId }))
  }, [])

  const setMode = useCallback((modeId) => {
    setState((s) => (s.status === 'idle' ? { ...s, modeId } : s))
  }, [])

  // Время вышло
  useEffect(() => {
    if (targetMs && state.status === 'running' && elapsed >= targetMs) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
      record(targetMs, state)
      setState({ ...initial, modeId: state.modeId })
      onCompleteRef.current?.() // например, остановить музыку
    }
  }, [elapsed, targetMs, state, record])

  // Статистика считается вживую: к завершённым сессиям добавляется текущая
  const stats = useMemo(() => {
    const d = new Date()
    const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    // неделя = с понедельника
    const weekStart = today - ((d.getDay() + 6) % 7) * 86400000
    let todayMs = 0, weekMs = 0, todayCount = 0
    for (const s of sessions) {
      if (s.start >= today) { todayMs += s.ms; todayCount++ }
      if (s.start >= weekStart) weekMs += s.ms
    }
    // Текущий запуск добавляем ко времени, но не к числу сессий: его ещё можно сбросить
    if (state.status !== 'idle') { todayMs += elapsed; weekMs += elapsed }
    return { todayMs, weekMs, todayCount }
  }, [sessions, state.status, state.sessionStart, elapsed])

  return {
    mode, status: state.status, elapsed, targetMs,
    display: targetMs ? Math.max(targetMs - elapsed, 0) : elapsed,
    progress: targetMs ? elapsed / targetMs : (elapsed % 60000) / 60000,
    start, pause, resume, reset, finish, setMode, stats,
  }
}

export function formatClock(ms) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function formatDuration(ms) {
  const sec = Math.floor(ms / 1000)
  if (!sec) return '—'
  if (sec < 60) return `${sec}с`
  const min = Math.floor(sec / 60)
  const h = Math.floor(min / 60)
  return h ? `${h}ч ${min % 60}м` : `${min}м`
}

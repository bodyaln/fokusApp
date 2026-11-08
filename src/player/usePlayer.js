import { useCallback, useEffect, useRef, useState } from 'react'

// repeat: 'off' | 'all' | 'one'
export function usePlayer(tracks) {
  const audioRef = useRef(null)
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
  }
  const audio = audioRef.current

  // Текущий трек запоминаем по id, а не по номеру в списке: если сверху добавится
  // новый трек или кто-то удалится, играть продолжит тот же самый трек
  const [currentId, setCurrentId] = useState(() => tracks[0]?.id)
  const found = tracks.findIndex((t) => t.id === currentId)
  const index = found >= 0 ? found : 0
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffering, setBuffering] = useState(false)
  const [muted, setMuted] = useState(false)
  const [repeat, setRepeat] = useState('off')

  const [error, setError] = useState('')

  const track = tracks[index]
  const idRef = useRef(track?.id)
  idRef.current = track?.id

  // Ошибки воспроизведения показываем, а не глотаем молча
  const onPlayError = useCallback((e) => {
    if (e?.name === 'AbortError') return // трек переключили, пока грузился, это нормально
    if (e?.name === 'NotAllowedError') setError('Браузер не дал включить звук, нажми ▶ ещё раз')
    else if (e?.name === 'NotSupportedError') setError('Файл не загрузился. Запущен ли сервер (npm run server)?')
    else setError('Не удалось включить трек')
    console.warn('[player] play():', e)
  }, [])

  // Загрузить трек в <audio> и (если autoplay) сразу запустить.
  // Важно: play() вызывается синхронно, прямо внутри нажатия на кнопку.
  // Safari и Telegram на iPhone разрешают звук только так; если вызвать play()
  // позже (например, после загрузки файла), браузер его молча блокирует.
  const loadTrack = useCallback((t, autoplay) => {
    if (!t) return
    if (audio.dataset.id !== t.id) {
      audio.dataset.id = t.id
      audio.src = t.url
      setCurrentTime(0)
      setDuration(t.duration || 0)
      setError('')
      // Новый трек всегда начинается с нуля (позицию прошлого прослушивания не восстанавливаем)
      audio.addEventListener('loadedmetadata', () => setDuration(audio.duration), { once: true })
    }
    if (autoplay) audio.play().catch(onPlayError)
  }, [onPlayError])

  // Текущий трек сменился не нажатием (первый запуск, трек удалили): просто загружаем, без звука
  useEffect(() => {
    if (track && audio.dataset.id !== track.id) loadTrack(track, false)
  }, [track?.id, loadTrack])

  const step = useCallback((dir) => {
    const list = tracksRef.current
    if (!list.length) return
    const cur = Math.max(0, list.findIndex((t) => t.id === idRef.current))
    const t = list[(cur + dir + list.length) % list.length]
    setCurrentId(t.id)
    loadTrack(t, true)
  }, [loadTrack])

  const next = useCallback(() => step(1), [step])

  const prev = useCallback(() => {
    // Как в обычных плеерах: если играет дольше 3 секунд, кнопка "назад" перематывает в начало
    if (audio.currentTime > 3) { audio.currentTime = 0; return }
    step(-1)
  }, [step])

  // События <audio>
  useEffect(() => {
    const onTime = () => setCurrentTime(audio.currentTime)
    const onPlay = () => { setPlaying(true); setError('') }
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      if (repeat === 'one') { audio.currentTime = 0; audio.play().catch(onPlayError); return }
      if (repeat === 'all' || index < tracks.length - 1) next()
      else setPlaying(false)
    }
    const onWaiting = () => setBuffering(true)
    const onPlaying = () => setBuffering(false)
    const onError = () => {
      setPlaying(false)
      setBuffering(false)
      // код ошибки браузера: 2 = сеть, 3 = не смог декодировать, 4 = формат/адрес не подходит
      const code = audio.error?.code
      setError(`Файл не загрузился (код ${code ?? '?'}). Запущен ли сервер (npm run server)?`)
      console.warn('[player] audio error', code, audio.error?.message, audio.currentSrc)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('error', onError)
    }
  }, [track?.id, repeat, index, tracks.length, next, onPlayError])

  const toggle = useCallback(() => {
    if (audio.paused) {
      // если в <audio> ещё ничего не загружено — грузим текущий трек прямо сейчас
      const t = tracksRef.current.find((x) => x.id === idRef.current) ?? tracksRef.current[0]
      loadTrack(t, true)
    } else audio.pause()
  }, [loadTrack])

  // Явные play/pause (для связки с таймером)
  const play = useCallback(() => { if (audio.paused) toggle() }, [toggle])
  const pause = useCallback(() => { if (!audio.paused) audio.pause() }, [])

  const seek = useCallback((t) => {
    audio.currentTime = t
    setCurrentTime(t)
  }, [])

  const skip = useCallback((sec) => {
    seek(Math.min(Math.max(audio.currentTime + sec, 0), audio.duration || 0))
  }, [seek])

  const toggleMute = useCallback(() => {
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }, [])

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }, [])

  const playAt = useCallback((i) => {
    const t = tracksRef.current[i]
    if (!t) return
    setCurrentId(t.id)
    loadTrack(t, true)
  }, [loadTrack])

  // Media Session: название и кнопки на экране блокировки / в системных контролах
  useEffect(() => {
    if (!track || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.author || '',
      artwork: track.cover ? [{ src: track.cover, sizes: '512x512' }] : [],
    })
    const handlers = {
      play: () => audio.play().catch(onPlayError),
      pause: () => audio.pause(),
      previoustrack: prev,
      nexttrack: next,
      seekbackward: () => skip(-15),
      seekforward: () => skip(30),
      seekto: (d) => seek(d.seekTime),
    }
    for (const [a, h] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(a, h) } catch {}
    }
  }, [track?.id, prev, next, skip, seek])

  return {
    track, index, playing, currentTime, duration, buffering, muted, repeat, error,
    toggle, play, pause, next, prev, seek, skip, toggleMute, cycleRepeat, playAt,
  }
}

export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return h ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`
}

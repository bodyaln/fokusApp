import { useRef, useState } from 'react'
import TrackItem from './TrackItem'
import { useHoldToReorder } from './useHoldToReorder'
import './music.css'

// youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..., music.youtube.com/...
const YT_RE = /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{11}/i

export default function MusicScreen({ onAdd, tracks, pending = [], p, onDelete, onRename, onReorder, onOpenPlayer }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const value = url.trim()
    if (!value) return
    if (!YT_RE.test(value)) {
      setError('Это не похоже на ссылку на YouTube')
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error')
      return
    }
    setError('')
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
    setUrl('')
    // Скачивание идёт в фоне: можно сразу вставлять следующую ссылку
    Promise.resolve(onAdd?.(value))
      .then(() => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'))
      .catch((err) => {
        setError(err.message)
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error')
      })
  }

  const play = (i) => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    if (i === p.index) p.toggle()
    else p.playAt(i)
  }

  // Тап по треку: включаем его и открываем плеер на весь экран
  // Зажал строку -> она «поднимается», и её можно перетащить выше или ниже
  const listRef = useRef(null)
  const reorder = useHoldToReorder({
    count: tracks.length,
    scrollRef: listRef,
    onReorder: (from, to) => onReorder(tracks[from].id, tracks[to].id),
  })

  const open = (i) => {
    if (reorder.wasDragged()) return // отпустил после перетаскивания — плеер не открываем
    if (i !== p.index || !p.playing) p.playAt(i)
    onOpenPlayer()
  }

  const remove = (t) => {
    const ask = `Удалить «${t.title}»?`
    const tg = window.Telegram?.WebApp
    // В Telegram — нативное окно подтверждения, в браузере — обычный confirm
    if (tg?.showConfirm && tg.platform !== 'unknown') tg.showConfirm(ask, (ok) => ok && onDelete(t.id))
    else if (window.confirm(ask)) onDelete(t.id)
  }

  return (
    <>
    <form className={`card linkbar ${error ? "has-error" : ""}`} onSubmit={submit} noValidate>
      <input
        className="linkbar__input"
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="https://youtube.com/watch?v=…"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError('') }}
        aria-label="Ссылка на YouTube"
      />
      <button className="linkbar__go" type="submit" disabled={!url.trim()} aria-label="Добавить">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </button>
      {error && <p className="linkbar__error">{error}</p>}
    </form>

    <section className={`card library ${reorder.draggingIndex !== null ? 'is-sorting' : ''}`} ref={listRef}>
      {tracks.length || pending.length ? (
        <ul className="library__list">
          {pending.map((t) => (
            <li key={'pending-' + t.id} className="track is-pending" aria-busy="true">
              <span className="track__cover">
                <img src={t.cover} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                <span className="track__spinner" aria-hidden="true" />
              </span>
              <span className="track__text">
                <span className="track__title">Скачиваю…</span>
                <span className="track__sub">{t.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </span>
            </li>
          ))}
          {tracks.map((t, i) => (
            <TrackItem
              key={t.id}
              track={t}
              current={p.track?.id === t.id}
              playing={p.playing}
              onOpen={() => open(i)}
              onPlay={() => play(i)}
              onDelete={() => remove(t)}
              onRename={(title) => onRename(t.id, title)}
              rowProps={reorder.bind(i)}
              rowStyle={reorder.style(i)}
              dragging={reorder.draggingIndex === i}
            />
          ))}
        </ul>
      ) : (
        <p className="library__empty">Пока пусто. Вставь ссылку сверху</p>
      )}
    </section>
    </>
  )
}

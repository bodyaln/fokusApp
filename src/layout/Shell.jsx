import * as I from '../player/icons'
import './shell.css'

export function MiniPlayer({ p, onOpen }) {
  if (!p.track) return null
  const progress = p.duration ? (p.currentTime / p.duration) * 100 : 0
  return (
    <div className="card mini">
      <button className="mini__info" onClick={onOpen}>
        <span className="mini__cover">
          {p.track.cover ? <img src={p.track.cover} alt="" /> : p.track.title.slice(0, 1)}
        </span>
        <span className="mini__text">
          <span className="mini__title">{p.track.title}</span>
          {p.error && <span className="mini__error">{p.error}</span>}
        </span>
      </button>
      <button className="mini__btn" onClick={p.toggleMute} aria-label={p.muted ? 'Включить звук' : 'Выключить звук'}>
        {p.muted ? <I.Mute /> : <I.Volume />}
      </button>
      <button className="mini__btn" onClick={p.toggle} aria-label={p.playing ? 'Пауза' : 'Играть'}>
        {p.playing ? <I.Pause /> : <I.Play />}
      </button>
      <span className="mini__bar" style={{ width: `${progress}%` }} />
    </div>
  )
}

const tabs = [
  { id: 'focus', label: 'Фокус', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg> },
  { id: 'music', label: 'Музыка', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg> },
]

export function BottomNav({ tab, onTab }) {
  return (
    <nav className="card nav">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`nav__item ${tab === t.id ? 'is-active' : ''}`}
          onClick={() => { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); onTab(t.id) }}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

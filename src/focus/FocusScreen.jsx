import { MODES, formatClock, formatDuration } from './useFocusTimer'
import './focus.css'

const R = 46
const CIRC = 2 * Math.PI * R

export default function FocusScreen({ t }) {
  const haptic = (kind = 'medium') => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(kind)
  const act = (fn, kind) => () => { haptic(kind); fn() }
  const idle = t.status === 'idle'

  return (
    <section className="card focus">
      <h1 className="focus__title">Фокус</h1>

      <div className="stats">
        <div className="stat"><span>сегодня</span><b>{formatDuration(t.stats.todayMs)}</b></div>
        <div className="stat"><span>за неделю</span><b>{formatDuration(t.stats.weekMs)}</b></div>
        <div className="stat"><span>сессий</span><b>{t.stats.todayCount || '—'}</b></div>
      </div>

      <div className="timer">
        <div className="timer__top">
          <label className={`pill pill--select pill--mode ${idle ? '' : 'is-locked'}`}>
            {!idle && <i className={`dot ${t.status === 'running' ? 'is-live' : ''}`} />}
            <span>{t.mode.label}</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            <select value={t.mode.id} disabled={!idle} onChange={(e) => t.setMode(e.target.value)} aria-label="Режим">
              {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        </div>

        <div className="dial-wrap">
        <div className={`dial ${t.status}`}>
          {!idle && <span className="dial__sweep" aria-hidden="true" />}
          <svg className="dial__ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={R} className="dial__track" />
            {!idle && (
              <circle
                cx="50" cy="50" r={R}
                className="dial__progress"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - t.progress)}
              />
            )}
          </svg>
          <div className="dial__face">
            <Decor />
            {idle ? (
              <>
                <span className="dial__ghost" aria-hidden="true">{t.mode.label}</span>
                <button className="dial__start" onClick={act(t.start, 'heavy')}>СТАРТ</button>
              </>
            ) : (
              <button
                className={`dial__hit ${t.status === 'paused' ? 'is-paused' : ''}`}
                onClick={act(t.status === 'running' ? t.pause : t.resume)}
                aria-label={t.status === 'running' ? 'Пауза' : 'Продолжить'}
              >
                {/* с часами (1:59:54) строка длиннее — шрифт поменьше, чтобы влезала в круг */}
                <span className={`dial__time ${t.display >= 3600000 ? 'is-long' : ''}`}>{formatClock(t.display)}</span>
                <span className="dial__overlay" aria-hidden="true">
                  {t.status === 'running'
                    ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
                    : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>}
                </span>
              </button>
            )}
          </div>
        </div>

        </div>

        {!idle && (
          <div className="timer__actions">
            <button className="glass-btn glass-btn--icon" onClick={act(t.finish, 'medium')} aria-label="Завершить" title="Завершить и сохранить"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg></button>
            {t.status === 'running'
              ? <button className="glass-btn glass-btn--main" onClick={act(t.pause)}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>Пауза</button>
              : <button className="glass-btn glass-btn--main glass-btn--accent" onClick={act(t.resume)}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>Продолжить</button>}
            <button className="glass-btn glass-btn--icon" onClick={act(t.reset, 'light')} aria-label="Сбросить" title="Сбросить без сохранения"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg></button>
          </div>
        )}
      </div>
    </section>
  )
}

// Декор внутри циферблата: деления как на часах и тонкие концентрические круги
const TICKS = Array.from({ length: 60 }, (_, i) => i)
function Decor() {
  return (
    <svg className="decor" viewBox="0 0 100 100" aria-hidden="true">
      <g className="decor__ticks">
        {TICKS.map((i) => (
          <line
            key={i}
            x1="50" y1={i % 5 ? 4.5 : 3.5}
            x2="50" y2="7.5"
            className={i % 5 ? '' : 'is-major'}
            transform={`rotate(${i * 6} 50 50)`}
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="38" className="decor__ring" />
      <circle cx="50" cy="50" r="32" className="decor__ring decor__ring--dash" />
      <circle cx="50" cy="50" r="24" className="decor__ring decor__ring--faint" />
      <circle cx="50" cy="50" r="15" className="decor__ring decor__ring--faint" />
      <g className="decor__orbit">
        <circle cx="50" cy="18" r="1.1" />
      </g>
    </svg>
  )
}

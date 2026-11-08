import { useState } from 'react'
import { formatTime } from './usePlayer'
import * as I from './icons'
import './player.css'

export default function Player({ p, liked, onLike }) {
  // Пока палец на ползунке, показываем его позицию, а не currentTime
  const [dragValue, setDragValue] = useState(null)
  const { track } = p
  if (!track) return null

  const value = dragValue ?? p.currentTime
  const progress = p.duration ? (value / p.duration) * 100 : 0

  const haptic = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
  const tap = (fn) => () => { haptic(); fn() }

  return (
    <section className="player">
      <header className="player__head">
        <span className="player__brand">FOCUSOS</span>
        <button className="btn btn--square" onClick={tap(p.toggleMute)} aria-label={p.muted ? 'Включить звук' : 'Выключить звук'}>
          {p.muted ? <I.Mute /> : <I.Volume />}
        </button>
      </header>

      <div className={`player__cover ${p.playing ? 'is-playing' : ''}`}>
        {track.cover
          ? <img src={track.cover} alt="" />
          : <div className="player__cover-fallback">{track.title.slice(0, 1)}</div>}
      </div>

      <div className="player__meta">
        <h2 className="player__title">{track.title}</h2>
        {track.author && <p className="player__author">{track.author}</p>}
      </div>

      <div className="player__progress">
        <input
          type="range"
          min={0}
          max={p.duration || 0}
          step={1}
          value={value}
          style={{ '--progress': `${progress}%` }}
          onChange={(e) => setDragValue(Number(e.target.value))}
          onPointerUp={() => { if (dragValue != null) { p.seek(dragValue); setDragValue(null) } }}
          onKeyUp={() => { if (dragValue != null) { p.seek(dragValue); setDragValue(null) } }}
          aria-label="Позиция"
        />
        <div className="player__times">
          <span>{formatTime(value)}</span>
          <span>{p.buffering ? 'загрузка…' : ''}</span>
          <span>{formatTime(p.duration)}</span>
        </div>
      </div>

      <div className="player__controls">
        <button
          className={`btn btn--sm ${p.repeat !== 'off' ? 'is-active' : ''}`}
          onClick={tap(p.cycleRepeat)}
          aria-label={`Повтор: ${p.repeat}`}
        >
          <I.Repeat />
          {p.repeat === 'one' && <span className="badge">1</span>}
        </button>
        <button className="btn" onClick={tap(p.prev)} aria-label="Предыдущий"><I.Prev /></button>
        <button className="btn btn--play" onClick={tap(p.toggle)} aria-label={p.playing ? 'Пауза' : 'Играть'}>
          {p.playing ? <I.Pause /> : <I.Play />}
        </button>
        <button className="btn" onClick={tap(p.next)} aria-label="Следующий"><I.Next /></button>
        <button className={`btn btn--sm ${liked ? 'is-liked' : ''}`} onClick={tap(onLike)} aria-label="Нравится">
          <I.Heart filled={liked} />
        </button>
      </div>

      <div className="player__skips">
        <button className="chip" onClick={() => p.skip(-15)}>−15 с</button>
        <button className="chip" onClick={() => p.skip(30)}>+30 с</button>
      </div>
    </section>
  )
}

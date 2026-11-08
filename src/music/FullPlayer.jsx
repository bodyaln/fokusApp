import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../player/usePlayer'
import * as I from '../player/icons'
import './fullplayer.css'

// Полноэкранный плеер. Открывается тапом по треку в списке или по мини-плееру.
export default function FullPlayer({ open, p, onClose }) {
  const [drag, setDrag] = useState(null) // позиция ползунка, пока его тянут

  // Закрытие: Esc на компе, системная кнопка «Назад» в Telegram
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const back = window.Telegram?.WebApp?.BackButton
    back?.show()
    back?.onClick(onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.offClick(onClose)
      back?.hide()
    }
  }, [open, onClose])

  // Свайп вниз для закрытия
  const sheetRef = useRef(null)
  const g = useRef(null) // { y, t, dy, moved }
  const onPointerDown = (e) => {
    if (!open || e.target.closest('input')) return // ползунок перематывает, а не закрывает
    g.current = { y: e.clientY, t: performance.now(), dy: 0, moved: false }
  }
  const onPointerMove = (e) => {
    const s = g.current
    if (!s) return
    s.dy = Math.max(0, e.clientY - s.y)
    if (s.dy > 8 && !s.moved) {
      s.moved = true
      // теперь это свайп: ловим движение, даже если палец ушёл за край.
      // (до этого не захватываем, иначе обычные нажатия на кнопки перестают работать)
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    if (!s.moved) return
    const el = sheetRef.current
    el.style.transition = 'none'
    el.style.transform = `translateY(${s.dy}px)`
  }
  const onPointerUp = () => {
    const s = g.current
    g.current = null
    if (!s || !s.moved) return
    const el = sheetRef.current
    el.style.transition = ''
    el.style.transform = ''
    const speed = s.dy / (performance.now() - s.t) // px/мс
    if (s.dy > 120 || (s.dy > 40 && speed > 0.5)) onClose()
    // клик по кнопке после свайпа не должен срабатывать
    const block = (ev) => { ev.stopPropagation(); ev.preventDefault() }
    el.addEventListener('click', block, { capture: true, once: true })
    setTimeout(() => el.removeEventListener('click', block, { capture: true }), 0)
  }

  // В Telegram свайп вниз по умолчанию сворачивает весь Mini App — отключаем, пока плеер открыт
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!open || !tg?.disableVerticalSwipes) return
    tg.disableVerticalSwipes()
    return () => tg.enableVerticalSwipes()
  }, [open])

  const { track } = p
  if (!track) return null

  const value = drag ?? p.currentTime
  const progress = p.duration ? (value / p.duration) * 100 : 0
  const commit = () => { if (drag != null) { p.seek(drag); setDrag(null) } }
  const tap = (fn) => () => { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); fn() }

  return (
    <div
      ref={sheetRef}
      className={`fp ${open ? 'is-open' : ''}`}
      aria-hidden={!open}
      role="dialog"
      aria-label="Плеер"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* фон: размытая обложка */}
      <div className="fp__bg" style={track.cover ? { backgroundImage: `url(${track.cover})` } : undefined} />

      <div className="fp__inner">
        {/* полоска сверху — подсказка, что плеер можно смахнуть вниз */}
        <div className="fp__grabber" aria-hidden="true" />

        <div className="fp__cover-wrap">
          <div className={`fp__cover ${p.playing ? 'is-playing' : ''}`}>
            {track.cover ? <img src={track.cover} alt="" draggable={false} /> : <i aria-hidden="true" />}
          </div>
        </div>

        <h2 className="fp__title">{track.title}</h2>

        <div className="fp__progress">
          <input
            type="range"
            min={0}
            max={p.duration || 0}
            step={1}
            value={value}
            style={{ '--progress': `${progress}%` }}
            onChange={(e) => setDrag(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            aria-label="Позиция"
          />
          <div className="fp__times">
            <span>{formatTime(value)}</span>
            <span>{formatTime(p.duration)}</span>
          </div>
        </div>

        <div className="fp__controls">
          <button
            className={`fp__btn ${p.repeat !== 'off' ? 'is-active' : ''}`}
            onClick={tap(p.cycleRepeat)}
            aria-label={p.repeat === 'one' ? 'Повтор: один трек' : p.repeat === 'all' ? 'Повтор: все' : 'Повтор выключен'}
            title={p.repeat === 'one' ? 'Повтор одного трека' : p.repeat === 'all' ? 'Повтор всех' : 'Повтор выключен'}
          >
            <I.Repeat />
            {p.repeat === 'one' && <span className="fp__badge">1</span>}
          </button>
          <div className="fp__transport">
            <button className="fp__btn fp__btn--md" onClick={tap(p.prev)} aria-label="Предыдущий"><I.Prev /></button>
            <button className="fp__play" onClick={tap(p.toggle)} aria-label={p.playing ? 'Пауза' : 'Играть'}>
              {p.playing ? <I.Pause /> : <I.Play />}
            </button>
            <button className="fp__btn fp__btn--md" onClick={tap(p.next)} aria-label="Следующий"><I.Next /></button>
          </div>
          <button className="fp__btn" onClick={tap(onClose)} aria-label="Закрыть" title="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

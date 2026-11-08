import { useEffect, useRef, useState } from 'react'

const Icon = {
  play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>,
  pause: <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" /></svg>,
  grip: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 9h14M5 15h14" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>,
}

export default function TrackItem({ track, current, playing, onOpen, onPlay, onDelete, onRename, rowProps, rowStyle, dragging }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(track.title)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const startEdit = () => { setDraft(track.title); setEditing(true) }
  const save = () => {
    const t = draft.trim()
    if (t && t !== track.title) onRename(t)
    setEditing(false)
  }

  return (
    <li className={`track ${current ? 'is-current' : ''} ${dragging ? 'is-dragging' : ''}`} style={rowStyle} {...(editing ? {} : rowProps)}>
      {editing ? (
        <div className="track__main">
          <span className="track__cover">
            {track.cover ? <img src={track.cover} alt="" /> : <i aria-hidden="true" />}
            {current && playing && <span className="track__eq" aria-hidden="true"><b /><b /><b /></span>}
          </span>
          <input
            ref={inputRef}
            className="track__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label="Название"
          />
        </div>
      ) : (
        // тап по обложке или названию открывает полноэкранный плеер
        <button className="track__main" onClick={onOpen} aria-label={`Открыть «${track.title}»`}>
          <span className="track__cover">
            {track.cover ? <img src={track.cover} alt="" /> : <i aria-hidden="true" />}
            {current && playing && <span className="track__eq" aria-hidden="true"><b /><b /><b /></span>}
          </span>
          <span className="track__title" title={track.title}>{track.title}</span>
        </button>
      )}

      <div className="track__actions">
        <button className="sq-btn" onClick={startEdit} aria-label="Изменить название" title="Изменить">{Icon.pen}</button>
        <button className="sq-btn sq-btn--danger" onClick={onDelete} aria-label="Удалить" title="Удалить">{Icon.trash}</button>
        <button className={`sq-btn ${current && playing ? 'is-on' : ''}`} onClick={onPlay} aria-label={current && playing ? 'Пауза' : 'Играть'}>
          {current && playing ? Icon.pause : Icon.play}
        </button>
        {/* за этот значок трек можно сразу перетащить выше или ниже */}
        <span className="track__handle" aria-label="Перетащить" title="Перетащить" role="button">{Icon.grip}</span>
      </div>
    </li>
  )
}

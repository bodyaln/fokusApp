import { formatTime } from './usePlayer'

export default function TrackList({ tracks, p }) {
  return (
    <section className="tracks">
      <h3 className="tracks__title">Библиотека</h3>
      <ul>
        {tracks.map((t, i) => {
          const current = i === p.index
          return (
            <li key={t.id}>
              <button className={`track ${current ? 'is-current' : ''}`} onClick={() => (current ? p.toggle() : p.playAt(i))}>
                <span className="track__thumb">
                  {t.cover ? <img src={t.cover} alt="" /> : t.title.slice(0, 1)}
                  {current && p.playing && <span className="eq"><i /><i /><i /></span>}
                </span>
                <span className="track__text">
                  <span className="track__name">{t.title}</span>
                  <span className="track__sub">{t.author}</span>
                </span>
                <span className="track__dur">{t.duration ? formatTime(t.duration) : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

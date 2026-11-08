import { useEffect, useState } from 'react'
import { getUsage } from '../lib/db'

// Бесплатные лимиты
const R2_LIMIT = 10 * 1000 ** 3 // 10 ГБ в Cloudflare R2
const DB_LIMIT = 500 * 1000 ** 2 // 500 МБ база в Supabase

function fmt(bytes) {
  if (bytes == null) return '—'
  const n = (x, d) => String(Number(x.toFixed(d))) // 10.00 -> 10, 1.50 -> 1.5
  if (bytes >= 1000 ** 3) return `${n(bytes / 1000 ** 3, 2)} ГБ`
  if (bytes >= 1000 ** 2) return `${n(bytes / 1000 ** 2, 1)} МБ`
  return `${Math.round(bytes / 1000)} КБ`
}

function Bar({ label, used, limit, note }) {
  const pct = used == null ? 0 : Math.min(100, (used / limit) * 100)
  return (
    <div className={`usage__row ${pct > 85 ? 'is-full' : ''}`}>
      <div className="usage__head">
        <span>{label}</span>
        <span>{fmt(used)} из {fmt(limit)}{note ? ` · ${note}` : ''}</span>
      </div>
      <div className="usage__bar"><i style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} /></div>
    </div>
  )
}

// Обновляется, когда меняется число готовых треков (refreshKey)
export default function StorageUsage({ refreshKey }) {
  const [u, setU] = useState(null)
  useEffect(() => {
    let alive = true
    getUsage().then((x) => alive && setU(x)).catch(() => {})
    return () => { alive = false }
  }, [refreshKey])

  if (!u) return null
  return (
    <div className="usage">
      <Bar label="Аудио · R2" used={u.r2Bytes} limit={R2_LIMIT} note={u.r2Files != null ? `${u.r2Files} файл.` : null} />
      <Bar label="База · Supabase" used={u.dbBytes} limit={DB_LIMIT} />
    </div>
  )
}

// Vercel-функция: POST /api/media
//   { action: 'sign',   paths: [...] } -> { urls: { path: временная ссылка на 24 ч } }
//   { action: 'delete', paths: [...] } -> { ok: true }
// Пускает только вошедшего пользователя и только к его файлам (путь начинается с его id).
import { createClient } from '@supabase/supabase-js'
import { r2FromEnv } from './_r2.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fhzskhcxfkrmotmwkcwo.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_rv9ag6TTCGtKQaoQKJdmgw_MCYEb3hA'

async function userIdFromToken(token) {
  if (!token) return null
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.getUser(token)
  return error ? null : data.user?.id ?? null
}

// Логика отдельно от HTTP, чтобы её можно было проверить без Vercel
export async function handle({ token, body }, deps = {}) {
  const getUserId = deps.getUserId || userIdFromToken
  const r2 = deps.r2 || r2FromEnv()
  if (!r2) return [500, { error: 'R2 не настроен: добавь переменные R2_* в настройках Vercel' }]
  const userId = await getUserId(token)
  if (!userId) return [401, { error: 'Нужно войти' }]

  const paths = (Array.isArray(body?.paths) ? body.paths : [])
    .filter((p) => typeof p === 'string' && p.startsWith(userId + '/') && !p.includes('..'))
    .slice(0, 500)

  if (body?.action === 'sign') {
    const urls = Object.fromEntries(await Promise.all(paths.map(async (p) => [p, await r2.sign(p)])))
    return [200, { urls }]
  }
  if (body?.action === 'delete') {
    await r2.remove(paths)
    return [200, { ok: true }]
  }
  return [400, { error: 'Неизвестное действие' }]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
    const [status, data] = await handle({ token, body })
    res.status(status).json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}

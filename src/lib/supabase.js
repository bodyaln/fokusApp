import { createClient } from '@supabase/supabase-js'

// Адрес проекта и publishable key публичные: они и так видны в браузере любому, кто откроет сайт.
// Доступ к данным защищают правила RLS в базе (каждый видит только свои треки).
// Secret key сюда класть НЕЛЬЗЯ — он только в server/.env на Маке.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://fhzskhcxfkrmotmwkcwo.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_rv9ag6TTCGtKQaoQKJdmgw_MCYEb3hA'

export const supabase = createClient(URL, KEY)

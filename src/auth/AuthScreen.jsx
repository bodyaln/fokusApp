import { useState } from 'react'
import { signIn, signUp } from '../lib/db'
import './auth.css'

const MESSAGES = {
  'Invalid login credentials': 'Неверная почта или пароль',
  'User already registered': 'Такой аккаунт уже есть — войди',
  'Email not confirmed': 'Почта не подтверждена. Открой письмо от Supabase и нажми ссылку',
}

export default function AuthScreen() {
  const [mode, setMode] = useState('in') // 'in' | 'up'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (password.length < 6) return setError('Пароль минимум 6 символов')
    setBusy(true)
    try {
      if (mode === 'in') await signIn(email.trim(), password)
      else {
        const session = await signUp(email.trim(), password)
        if (!session) {
          setInfo('Готово. Подтверди почту по ссылке из письма и войди')
          setMode('in')
        }
      }
    } catch (err) {
      setError(MESSAGES[err.message] || err.message || 'Не получилось')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="card auth__card" onSubmit={submit}>
        <h1 className="auth__title">focusOs</h1>
        <p className="auth__sub">{mode === 'in' ? 'Вход' : 'Новый аккаунт'}: один плейлист на телефоне и компе</p>

        <input
          className="auth__input"
          type="email"
          autoComplete="email"
          placeholder="Почта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="auth__input"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="auth__error">{error}</p>}
        {info && <p className="auth__info">{info}</p>}

        <button className="auth__btn" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'Войти' : 'Создать аккаунт'}
        </button>

        <button
          type="button"
          className="auth__switch"
          onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); setInfo('') }}
        >
          {mode === 'in' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
        </button>
      </form>
    </div>
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Внутри Telegram: сообщаем, что приложение готово, и разворачиваем на весь экран.
// В обычном браузере window.Telegram не будет, и это нормально.
const tg = window.Telegram?.WebApp
if (tg) {
  tg.ready()
  tg.expand()
  tg.setHeaderColor?.('#1f1e15')
  tg.setBackgroundColor?.('#15140f')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

# FocusOS

Таймер фокуса + музыка с YouTube. Один плейлист на всех устройствах.

- Приложение: React + Vite (потом Vercel)
- Аккаунт, плейлист, статистика: Supabase (база)
- Аудио и обложки: Cloudflare R2 (приватный бакет), папка `<id пользователя>/`
- Ссылки на файлы: функция `api/media.js` на Vercel (проверяет вход, подписывает ссылки на 24 ч)
- Скачивание: `server/worker.js` на Маке (yt-dlp + ffmpeg)

## Первый запуск

    brew install yt-dlp ffmpeg
    npm install
    cp server/.env.example server/.env    # и вставить secret key из Supabase

Два терминала:

    npm run dev       # приложение, http://localhost:5173
    npm run worker    # качалка: берёт ссылки из очереди и загружает в Supabase

Ссылку можно добавить с любого устройства, даже когда Мак выключен: трек будет «в очереди»
и скачается, когда запустится `npm run worker`.

Аудио хранится в R2 в исходном качестве (~128 kbps), лимита на размер файла нет.
Переменные R2_* нужны в двух местах: в server/.env (качалка) и в Vercel → Settings →
Environment Variables (функция /api/media). При локальной разработке /api уходит на Vercel.

## Структура

- src/lib/db.js — вся работа с Supabase
- src/auth/ — экран входа
- src/music/useLibrary.js — плейлист из базы, живые обновления
- src/music/ — строка ссылки, список, полноэкранный плеер, перетаскивание
- src/focus/ — таймер и статистика
- src/player/usePlayer.js — воспроизведение
- server/worker.js — качалка
- api/media.js, api/_r2.js — ссылки на файлы в R2 и их удаление (Vercel)
- server/index.js — старый локальный сервер (больше не нужен)

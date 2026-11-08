# FocusOS

Таймер фокуса + музыка с YouTube. Один плейлист на всех устройствах.

- Приложение: React + Vite (потом Vercel)
- Аккаунт, плейлист, статистика: Supabase (база)
- Аудио и обложки: Supabase Storage, приватная папка `media/<id пользователя>/`
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

Файлы больше 45 МБ (примерно от 45 минут звука) качалка сама пережимает, чтобы влезть
в лимит бесплатного Supabase (50 МБ на файл).

## Структура

- src/lib/db.js — вся работа с Supabase
- src/auth/ — экран входа
- src/music/useLibrary.js — плейлист из базы, живые обновления
- src/music/ — строка ссылки, список, полноэкранный плеер, перетаскивание
- src/focus/ — таймер и статистика
- src/player/usePlayer.js — воспроизведение
- server/worker.js — качалка
- server/index.js — старый локальный сервер (больше не нужен)

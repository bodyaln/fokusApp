# FocusOS

Telegram Mini App: таймер фокуса + музыка с YouTube. React + Vite, сервер на Node.

## Запуск

Один раз поставить yt-dlp и ffmpeg:

    brew install yt-dlp ffmpeg

Дальше два терминала в папке проекта:

    npm run server     # сервер скачивания, http://localhost:8787
    npm run dev        # приложение, http://localhost:5173

Вставь ссылку на YouTube во вкладке «Музыка» и нажми стрелку: сервер скачает звук (m4a) и обложку
в папку `server/media`, и трек появится в списке.

Если YouTube пишет «Sign in to confirm you're not a bot»:

    COOKIES_BROWSER=safari npm run server     # или chrome

Если yt-dlp перестал качать, обнови его: `brew upgrade yt-dlp`.

## Структура

- server/index.js — сервер: POST/GET/DELETE /api/tracks и раздача файлов /media
- src/music/ — вкладка «Музыка»: строка ссылки, список, полноэкранный плеер, api.js
- src/focus/ — вкладка «Фокус»: таймер и статистика
- src/player/usePlayer.js — логика воспроизведения
- src/layout/Shell.jsx — мини-плеер и нижняя навигация

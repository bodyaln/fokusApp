// Пока тестовые треки. Потом этот список будет приходить с бэкенда:
// GET /api/tracks -> [{ id, title, author, duration, cover, url }]
// где url — временная ссылка на файл в Cloudflare R2.
export const demoTracks = [
  {
    id: 'demo-1',
    title: 'Sunday Grind',
    author: 'FocusOS demo',
    duration: 90,
    cover: '/demo/cover1.svg',
    url: '/demo/track1.m4a',
  },
  {
    id: 'demo-2',
    title: 'Deep Work Session',
    author: 'FocusOS demo',
    duration: 60,
    cover: '/demo/cover2.svg',
    url: '/demo/track2.m4a',
  },
]

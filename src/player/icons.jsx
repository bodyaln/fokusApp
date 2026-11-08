const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const Play = () => <svg {...base} fill="currentColor" stroke="none"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
export const Pause = () => <svg {...base} fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
export const Prev = () => <svg {...base}><path d="M6 5v14" /><path d="M18 6.5v11a.8.8 0 0 1-1.2.7L9 12.7a.8.8 0 0 1 0-1.4l7.8-5.5a.8.8 0 0 1 1.2.7z" /></svg>
export const Next = () => <svg {...base}><path d="M18 5v14" /><path d="M6 6.5v11a.8.8 0 0 0 1.2.7l7.8-5.5a.8.8 0 0 0 0-1.4L7.2 5.8A.8.8 0 0 0 6 6.5z" /></svg>
export const Repeat = () => <svg {...base}><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
export const Heart = ({ filled }) => <svg {...base} fill={filled ? 'currentColor' : 'none'}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
export const Volume = () => <svg {...base}><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></svg>
export const Mute = () => <svg {...base}><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M22 9l-6 6" /><path d="M16 9l6 6" /></svg>

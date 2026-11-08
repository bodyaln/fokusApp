import { useCallback, useEffect, useRef, useState } from 'react'

const HOLD_MS = 350 // сколько держать палец/кнопку мыши, чтобы трек «поднялся»
const MOVE_TOLERANCE = 8 // если за это время сдвинулся дальше, значит это прокрутка, а не перетаскивание
const EDGE = 48 // у края списка он сам прокручивается
const GAP = 8 // расстояние между строками (как gap в .library__list)

// Перетаскивание строк списка по долгому нажатию.
// Возвращает: bind(i) для каждой строки, style(i) со сдвигом строки, draggingIndex,
// и wasDragged() — чтобы клик после перетаскивания не открыл плеер.
export function useHoldToReorder({ count, scrollRef, onReorder }) {
  const [drag, setDragState] = useState(null) // { from, to, dy, rowH }
  const dragRef = useRef(null)
  const setDrag = (d) => { dragRef.current = d; setDragState(d) }
  const s = useRef(null)
  const justDragged = useRef(false)

  const stop = useCallback(() => {
    const st = s.current
    s.current = null
    if (!st) return
    clearTimeout(st.timer)
    window.removeEventListener('pointermove', st.onMove)
    window.removeEventListener('pointerup', st.onUp)
    window.removeEventListener('pointercancel', st.onUp)
  }, [])

  const bind = (i) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return
      // За значок ≡ можно тащить сразу, без удержания
      const fromHandle = !!e.target.closest('.track__handle')
      if (!fromHandle && e.target.closest('.sq-btn, input')) return // кнопки ✎ 🗑 ▶ и поле ввода работают как обычно
      if (fromHandle) e.preventDefault()
      stop()
      const row = e.currentTarget
      const list = scrollRef.current
      const st = {
        i,
        x: e.clientX,
        y: e.clientY,
        scroll0: list?.scrollTop ?? 0,
        rowH: row.offsetHeight + GAP,
        active: false,
      }
      const compute = (clientY) => {
        const dy = clientY - st.y + ((list?.scrollTop ?? 0) - st.scroll0)
        const to = Math.max(0, Math.min(count - 1, st.i + Math.round(dy / st.rowH)))
        setDrag({ from: st.i, to, dy, rowH: st.rowH })
      }
      st.onMove = (ev) => {
        if (!st.active) {
          if (Math.hypot(ev.clientX - st.x, ev.clientY - st.y) > MOVE_TOLERANCE) stop() // это прокрутка
          return
        }
        st.lastY = ev.clientY
        // автопрокрутка у краёв списка
        if (list) {
          const r = list.getBoundingClientRect()
          if (ev.clientY < r.top + EDGE) list.scrollTop -= 8
          else if (ev.clientY > r.bottom - EDGE) list.scrollTop += 8
        }
        compute(ev.clientY)
      }
      st.onUp = () => {
        if (st.active) {
          justDragged.current = true
          setTimeout(() => (justDragged.current = false), 0)
          // onReorder вызываем снаружи setState: внутри него React в dev-режиме
          // вызывает функцию дважды, и трек сдвигался два раза
          const d = dragRef.current
          setDrag(null)
          if (d && d.to !== d.from) onReorder(d.from, d.to)
        }
        stop()
      }
      const activate = () => {
        st.active = true
        window.getSelection?.().removeAllRanges()
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
        navigator.vibrate?.(15)
        compute(st.lastY ?? st.y)
      }
      // за ≡ — сразу; за остальную строку — после удержания
      if (fromHandle) activate()
      else st.timer = setTimeout(activate, HOLD_MS)
      window.addEventListener('pointermove', st.onMove)
      window.addEventListener('pointerup', st.onUp)
      window.addEventListener('pointercancel', st.onUp)
      s.current = st
    },
    // на телефоне долгое нажатие открывает системное меню — отключаем
    onContextMenu: (e) => e.preventDefault(),
  })

  // Пока тащим, страница и список не должны прокручиваться от пальца
  useEffect(() => {
    if (!drag) return
    const block = (e) => e.preventDefault()
    window.addEventListener('touchmove', block, { passive: false })
    return () => window.removeEventListener('touchmove', block)
  }, [drag])

  useEffect(() => stop, [stop])

  const style = (i) => {
    if (!drag) return undefined
    const { from, to, dy, rowH } = drag
    if (i === from) return { transform: `translateY(${dy}px) scale(1.03)`, transition: 'none' }
    if (from < to && i > from && i <= to) return { transform: `translateY(${-rowH}px)` }
    if (from > to && i >= to && i < from) return { transform: `translateY(${rowH}px)` }
    return { transform: 'none' }
  }

  const wasDragged = () => justDragged.current

  return { bind, style, draggingIndex: drag?.from ?? null, wasDragged }
}

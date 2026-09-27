import { useEffect, useRef } from 'react'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Writes the element's scroll progress to CSS variables every frame it is on screen, with no React
 * re-renders. CSS then drives parallax, masks, and horizontal galleries from those variables.
 *   --progress: 0 when the element's top enters the bottom of the viewport, 1 when its bottom leaves the top
 *   --pin:      0..1 across the element's height minus one viewport (for sticky, pinned sections)
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) {
      el.style.setProperty('--progress', '0.5')
      el.style.setProperty('--pin', '0')
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const progress = (vh - r.top) / (vh + r.height)
      const pinSpan = Math.max(1, r.height - vh)
      el.style.setProperty('--progress', Math.min(1, Math.max(0, progress)).toFixed(4))
      el.style.setProperty('--pin', Math.min(1, Math.max(0, -r.top / pinSpan)).toFixed(4))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return ref
}

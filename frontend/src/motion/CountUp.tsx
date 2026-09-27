import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from './useScrollProgress'

/** Counts from 0 to `to` with an ease-out when it scrolls into view (impact-number style). */
export default function CountUp({ to, duration = 1600, format = (n: number) => String(n) }: {
  to: number
  duration?: number
  format?: (n: number) => string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(prefersReducedMotion() ? to : 0)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) {
      setValue(to)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        setValue(Math.round(to * (1 - Math.pow(1 - t, 3))))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, duration])

  return <span ref={ref}>{format(value)}</span>
}

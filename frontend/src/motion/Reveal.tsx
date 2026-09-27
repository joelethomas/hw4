import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { prefersReducedMotion } from './useScrollProgress'

type Variant = 'up' | 'fade' | 'left' | 'right' | 'zoom' | 'mask'

interface Props {
  children: ReactNode
  as?: ElementType
  variant?: Variant
  delay?: number // ms
  className?: string
  style?: CSSProperties
}

/** Fades/slides its children in the first time they scroll into view (like Coral Gardeners' sections). */
export default function Reveal({ children, as: Tag = 'div', variant = 'up', delay = 0, className = '', style }: Props) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(prefersReducedMotion)

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  // The mask variant clips an inner span: IntersectionObserver ignores fully clipped areas, so the
  // observed outer element must stay unclipped or it would never count as "in view".
  if (variant === 'mask') {
    return (
      <Tag ref={ref} className={`reveal-mask${shown ? ' is-visible' : ''} ${className}`} style={style}>
        <span className="reveal-inner" style={{ transitionDelay: `${delay}ms` }}>
          {children}
        </span>
      </Tag>
    )
  }

  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${variant}${shown ? ' is-visible' : ''} ${className}`}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}

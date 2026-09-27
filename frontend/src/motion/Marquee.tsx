/** Endless horizontal ticker; the list is rendered twice so the CSS loop is seamless. */
export default function Marquee({ items, className = '' }: { items: string[]; className?: string }) {
  const row = (hidden: boolean) => (
    <div className="marquee-row" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span key={i} className="marquee-item">
          {item}
          <span className="marquee-dot">✦</span>
        </span>
      ))}
    </div>
  )
  return (
    <div className={`marquee ${className}`}>
      <div className="marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}

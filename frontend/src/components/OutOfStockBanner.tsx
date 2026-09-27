// Diagonal ribbon across a product image; the parent must be an .img-wrap.
export default function OutOfStockBanner({ size }: { size?: string | null }) {
  return (
    <div className="oos-banner" role="status">
      {size ? `Out of stock · ${size}` : 'Out of stock'}
    </div>
  )
}

import { Link } from 'react-router-dom'
import { formatPrice, type ProductSummary } from '../api'
import { swatch } from '../colors'
import OutOfStockBanner from './OutOfStockBanner'

const MAX_SWATCHES = 4

// Used by the Products grid, Home's featured picks, and chat results on the Products page.
export default function ProductCard({ product, index = 0 }: { product: ProductSummary; index?: number }) {
  const colors = [...new Set(product.colors.map(swatch))]
  return (
    <Link
      to={`/products/${product.product_id}`}
      className="card"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="img-wrap card-media">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        {product.stock_status === 'out_of_stock' && <OutOfStockBanner />}
        {product.stock_status === 'low_stock' && <span className="pill low">Low stock</span>}
      </div>
      <div className="card-body">
        <p className="card-eyebrow">{product.garment_type}</p>
        <h3>{product.name}</h3>
        <p className="card-desc">{product.short_description}</p>
        <div className="card-footer">
          <span className="price">{formatPrice(product.price)}</span>
          <span className="swatches" aria-label={`Colors: ${product.colors.join(', ')}`}>
            {colors.slice(0, MAX_SWATCHES).map((c) => (
              <span key={c} className="swatch" style={{ background: c }} />
            ))}
            {colors.length > MAX_SWATCHES && <span className="swatch-more">+{colors.length - MAX_SWATCHES}</span>}
          </span>
        </div>
      </div>
    </Link>
  )
}

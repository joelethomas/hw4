import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, formatPrice, type ProductDetail as Product } from '../api'
import { useChatResults } from '../chatResultsContext'
import { openDan } from '../chatControl'
import OutOfStockBanner from '../components/OutOfStockBanner'
import { usePageDetails } from '../pageContext'

export default function ProductDetail() {
  const { productId = '' } = useParams()
  // Keying on the id gives each product fresh state instead of resetting it in an effect.
  return <ProductView key={productId} productId={productId} />
}

function ProductView({ productId }: { productId: string }) {
  const { results } = useChatResults()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  usePageDetails(selectedSize) // lets the chat answer "is this in stock?" for the selected size

  useEffect(() => {
    fetchProduct(productId)
      .then(setProduct)
      .catch((e: Error) => setError(e.message))
  }, [productId])

  if (error) {
    return (
      <p className="container error">
        Couldn't load this product ({error}). <Link to="/products">Back to products</Link>
      </p>
    )
  }
  if (!product) return <div className="container detail-skeleton" aria-busy="true" />

  const selected = product.inventory.find((s) => s.size === selectedSize) ?? null
  const soldOut = product.total_stock === 0
  const stockLabel = (quantity: number) =>
    quantity === 0 ? 'Out of stock' : quantity < 5 ? `Only ${quantity} left` : `${quantity} in stock`

  return (
    <div className="container">
      <Link to="/products" className="back">
        {results ? `← Back to “${results.title}”` : '← All products'}
      </Link>
      <div className="detail">
        <div className="img-wrap detail-image">
          <img src={product.image_url} alt={product.name} />
          {soldOut ? (
            <OutOfStockBanner />
          ) : (
            selected?.quantity === 0 && <OutOfStockBanner size={selected.size} />
          )}
        </div>
        <div className="detail-info">
          <p className="kicker dark">{product.garment_type}</p>
          <h1 className="display">{product.name}</h1>
          <p className="price large">{formatPrice(product.price)}</p>
          <p>{product.description}</p>

          <h2>Colors</h2>
          <div className="chips">
            {product.colors.map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>

          <h2>Sizes &amp; stock</h2>
          <div className="sizes" role="radiogroup" aria-label="Size">
            {product.inventory.map((s) => (
              <button
                key={s.size}
                type="button"
                role="radio"
                aria-checked={s.size === selectedSize}
                className={`size${s.quantity === 0 ? ' out' : ''}${s.size === selectedSize ? ' selected' : ''}`}
                onClick={() => setSelectedSize(s.size === selectedSize ? null : s.size)}
              >
                <span className="size-name">{s.size}</span>
                <span className="size-stock">{stockLabel(s.quantity)}</span>
              </button>
            ))}
          </div>
          <p className={soldOut || selected?.quantity === 0 ? 'error' : 'muted'}>
            {soldOut
              ? 'This item is out of stock in every size.'
              : selected
                ? `Size ${selected.size}: ${stockLabel(selected.quantity).toLowerCase()}.`
                : `${product.total_stock} units available across all sizes. Select a size to check it.`}
          </p>
          <div className="detail-actions">
            <button
              className="button"
              onClick={() => openDan(selected ? `Is this in stock in ${selected.size}?` : 'What sizes are in stock?')}
            >
              <img src="/brand/dan.png" alt="" className="btn-avatar" /> Ask Dan about this
            </button>
            <p className="muted small">Officially licensed · Available at 57 Broadway</p>
          </div>
        </div>
      </div>
    </div>
  )
}

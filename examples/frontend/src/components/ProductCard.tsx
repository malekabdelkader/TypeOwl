import type { Product } from '@typeowl';

export function ProductCard({ product }: { product: Product }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius)',
      padding: '1.25rem',
      border: '1px solid var(--border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{product.name}</h3>
        {product.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{product.description}</p>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ 
          fontSize: '1.25rem', 
          fontWeight: 700, 
          color: 'var(--accent)',
        }}>
          ${product.price}
        </div>
        <span style={{
          fontSize: '0.7rem',
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          background: product.inStock ? 'var(--success)22' : 'var(--error)22',
          color: product.inStock ? 'var(--success)' : 'var(--error)',
          fontWeight: 500,
        }}>
          {product.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>
    </div>
  );
}


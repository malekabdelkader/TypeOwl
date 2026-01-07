import { useState, useEffect } from 'react';

// 🦉 Import types from TypeOwl
import type { 
  Blog,                           // 🟡 Static type from src/types/
  GetApiUsersResponse,            // 🟢 Array type from typeowl.endpoint()
  Product,
} from '@typeowl';

// API client with 3 fetch methods
import { api, rawFetch, typedFetch, type HealthResponse } from './api';

// Components
import { UserCard, BlogCard, ProductCard, HealthStatus, Section } from './components';

export default function App() {
  const [users, setUsers] = useState<GetApiUsersResponse>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // 🔴 OPTION 1: Raw fetch - No TypeOwl
        const healthData = await rawFetch<HealthResponse>('/api/health');
        setHealth(healthData);

        // 🟡 OPTION 2: Force-cast with static types
        const blogsData = await typedFetch<Blog[]>('/api/blogs');
        setBlogs(blogsData);

        // 🟢 OPTION 3: typeowl.endpoint() - Full type safety
        // No casting needed! Types are automatically inferred as arrays
        const [usersData, productsData] = await Promise.all([
          api.get('/api/users'),
          api.get('/api/products'),
        ]);
        setUsers(usersData);
        setProducts(productsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem', flex: 1 }}>
      {/* Header */}
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <img 
          src="/typeOwl.logo.png" 
          alt="TypeOwl Logo" 
          style={{ width: 80, height: 80, marginBottom: '0.5rem' }} 
        />
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 700,
          background: 'linear-gradient(135deg, var(--accent), #fff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem',
        }}>
          TypeOwl Example
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Types synced from backend → Full autocomplete in frontend
        </p>
      </header>

      {/* Code Examples Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.5rem' }}>
          ✨ TYPE SAFETY IN ACTION
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <code>🔴 const health = await rawFetch&lt;HealthResponse&gt;('/api/health');</code>
          <code>🟡 const blogs = await typedFetch&lt;Blog[]&gt;('/api/blogs');</code>
          <code>🟢 const users = await api.get('/api/users');</code>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading...
        </div>
      ) : error ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          background: 'var(--error)11',
          borderRadius: 'var(--radius)',
          color: 'var(--error)',
        }}>
          {error}
          <div style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Make sure the backend is running on port 3001
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* 🔴 Health - No TypeOwl */}
          <Section 
            icon="🔴" 
            title="Health Check" 
            subtitle="(no TypeOwl - manual type)"
          >
            <HealthStatus status={health} />
          </Section>

          {/* 🟢 Users - typeowl.endpoint() */}
          <Section 
            icon="🟢" 
            title="Users" 
            subtitle={<>(<code>typeowl.endpoint()</code> - full type safety)</>}
            gridColumns="repeat(auto-fill, minmax(280px, 1fr))"
          >
            {users.map(user => <UserCard key={user.id} user={user} />)}
          </Section>

          {/* 🟡 Blogs - Static types */}
          <Section 
            icon="🟡" 
            title="Blogs" 
            subtitle={<>(force-cast with <code>Blog</code> type)</>}
          >
            {blogs.map(blog => <BlogCard key={blog.id} blog={blog} />)}
          </Section>

          {/* 🟢 Products - typeowl.endpoint() */}
          <Section 
            icon="🟢" 
            title="Products" 
            subtitle={<>(<code>typeowl.endpoint()</code> - full type safety)</>}
          >
            {products.map(product => <ProductCard key={product.id} product={product} />)}
          </Section>
        </div>
      )}

      {/* Footer */}
      <footer style={{ 
        marginTop: '3rem', 
        paddingTop: '2rem',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}>
        Types fetched from <code>http://localhost:3001/__typeowl</code>
      </footer>
    </div>
  );
}

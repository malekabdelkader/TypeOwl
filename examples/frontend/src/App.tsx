import { useState, useEffect } from 'react';

// 🦉 Import types from TypeOwl
import type { 
  Blog,                           // 🟡 Static type from src/types/
  GetApiUsersResponse,            // 🟢 Array type from typeowl.endpoint()
  Product,
} from 'typeowl/types';

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
    <div style={{ 
      maxWidth: 900, 
      margin: '0 auto', 
      padding: '6rem 2rem 2rem',  // Extra top padding for fixed nav
      flex: 1 
    }}>
      {/* Page Header */}
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 700,
          background: 'linear-gradient(135deg, #fffffe, var(--accent))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.75rem',
        }}>
          Live API Examples
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          Interactive demonstration of TypeOwl's three type-sharing approaches
        </p>
      </header>

      {/* Code Examples Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))',
        borderRadius: 'var(--radius)',
        padding: '1.5rem',
        marginBottom: '2.5rem',
        border: '1px solid var(--border)',
      }}>
        <div style={{ 
          fontSize: '0.8rem', 
          color: 'var(--accent)', 
          fontWeight: 600, 
          marginBottom: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          ✨ Type Safety in Action
        </div>
        <div style={{ 
          fontSize: '0.875rem', 
          color: 'var(--text-secondary)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.5rem',
          fontFamily: 'var(--font-mono)'
        }}>
          <div><span style={{ marginRight: '0.5rem' }}>🔴</span><code style={{ background: 'none', padding: 0 }}>const health = await rawFetch&lt;HealthResponse&gt;('/api/health');</code></div>
          <div><span style={{ marginRight: '0.5rem' }}>🟡</span><code style={{ background: 'none', padding: 0 }}>const blogs = await typedFetch&lt;Blog[]&gt;('/api/blogs');</code></div>
          <div><span style={{ marginRight: '0.5rem' }}>🟢</span><code style={{ background: 'none', padding: 0 }}>const users = await api.get('/api/users');</code></div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '4rem', 
          color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🦉</div>
          Loading data from API...
        </div>
      ) : error ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: 'var(--error)',
        }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            ❌ {error}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Make sure the backend is running: <code>cd examples/backend && npm run dev</code>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2.5rem' }}>
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
        marginTop: '4rem', 
        paddingTop: '2rem',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}>
        <p>Types fetched from <code>http://localhost:3001/__typeowl</code></p>
        <p style={{ marginTop: '0.5rem' }}>
          <a href="/docs/index.html" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Read the docs</a>
          {' · '}
          <a href="/engine/index.html" style={{ color: 'var(--accent)', textDecoration: 'none' }}>How it works</a>
        </p>
      </footer>
    </div>
  );
}

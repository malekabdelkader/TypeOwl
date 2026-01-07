import { useState, useEffect } from 'react';

// 🦉 Import types from TypeOwl!
// These are fetched from the backend and generated locally
import type { User, Post, ApiEndpoints, ApiError } from '@typeowl';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 TYPE-SAFE API CLIENT
// ═══════════════════════════════════════════════════════════════════════════

type EndpointKey = keyof ApiEndpoints;

async function api<K extends EndpointKey>(
  endpoint: K,
  options?: {
    body?: ApiEndpoints[K] extends { body: infer B } ? B : never;
  }
): Promise<ApiEndpoints[K]['response']> {
  const [method, path] = endpoint.split(' ');
  
  const response = await fetch(path, {
    method,
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error);
  }
  
  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧩 COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function UserCard({ user }: { user: User }) {
  const roleColors = {
    admin: '#f59e0b',
    user: '#22c55e', 
    guest: '#6b7280',
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius)',
      padding: '1.25rem',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${roleColors[user.role]}, ${roleColors[user.role]}88)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: '1rem',
        }}>
          {user.name?.[0] || user.email[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 500 }}>{user.name || 'Anonymous'}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{user.email}</div>
        </div>
      </div>
      <div style={{ 
        display: 'inline-block',
        fontSize: '0.75rem', 
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        background: `${roleColors[user.role]}22`,
        color: roleColors[user.role],
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {user.role}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius)',
      padding: '1.25rem',
      border: '1px solid var(--border)',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        marginBottom: '0.5rem',
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{post.title}</h3>
        {post.published && (
          <span style={{
            fontSize: '0.7rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'var(--success)',
            color: 'white',
            fontWeight: 500,
          }}>
            Published
          </span>
        )}
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{post.content}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 📱 MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Type-safe API calls! 🎉
        const [usersData, postsData] = await Promise.all([
          api('GET /api/users'),
          api('GET /api/posts'),
        ]);
        
        setUsers(usersData);
        setPosts(postsData);
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
      padding: '2rem',
      flex: 1,
    }}>
      {/* Header */}
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🦉</div>
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

      {/* Type Info Banner */}
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
        <code style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          import type {'{'} User, Post, ApiEndpoints {'}'} from '@typeowl';
        </code>
      </div>

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
          {/* Users Section */}
          <section>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 600, 
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span>👥</span> Users
              <span style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}>
                (typed as <code>User[]</code>)
              </span>
            </h2>
            <div style={{ 
              display: 'grid', 
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}>
              {users.map(user => (
                <UserCard key={user.id} user={user} />
              ))}
            </div>
          </section>

          {/* Posts Section */}
          <section>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 600, 
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span>📝</span> Posts
              <span style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}>
                (typed as <code>Post[]</code>)
              </span>
            </h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
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


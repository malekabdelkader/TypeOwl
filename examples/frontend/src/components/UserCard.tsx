import type { GetApiUsersByIdResponse as User } from '@typeowl';

const roleColors = {
  admin: '#f59e0b',
  user: '#22c55e', 
  guest: '#6b7280',
};

export function UserCard({ user }: { user: User }) {
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


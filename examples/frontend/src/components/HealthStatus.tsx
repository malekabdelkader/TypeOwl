import type { HealthResponse } from '../api/types';

export function HealthStatus({ status }: { status: HealthResponse | null }) {
  if (!status) return null;
  
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius)',
      padding: '1rem 1.25rem',
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      <div style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: status.status === 'ok' ? 'var(--success)' : 'var(--error)',
        boxShadow: `0 0 8px ${status.status === 'ok' ? 'var(--success)' : 'var(--error)'}`,
      }} />
      <div>
        <span style={{ fontWeight: 500 }}>API Status: </span>
        <span style={{ color: 'var(--text-secondary)' }}>{status.status}</span>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {new Date(status.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}


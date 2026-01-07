import type { ReactNode } from 'react';

interface SectionProps {
  icon: string;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  gridColumns?: string;
}

export function Section({ icon, title, subtitle, children, gridColumns }: SectionProps) {
  return (
    <section>
      <h2 style={{ 
        fontSize: '1.25rem', 
        fontWeight: 600, 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span>{icon}</span> {title}
        <span style={{ 
          fontSize: '0.75rem', 
          color: 'var(--text-muted)',
          fontWeight: 400,
        }}>
          {subtitle}
        </span>
      </h2>
      <div style={{ 
        display: 'grid', 
        gap: '0.75rem',
        gridTemplateColumns: gridColumns,
      }}>
        {children}
      </div>
    </section>
  );
}


import type { Blog, BlogInput } from '@typeowl';
import { useState } from 'react';
import { api } from '../api';

export function BlogCard({ blog }: { blog: Blog }) {

  const [blogForm, setBlogForm] = useState<BlogInput>({title: '', content: ''});
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBlogForm({...blogForm, [e.target.name]: e.target.value});
  };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    api.post('/api/blogs', { body: blogForm });
  };
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
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{blog.title}</h3>
        {blog.published && (
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
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{blog.content}</p>
    </div>
  );
}


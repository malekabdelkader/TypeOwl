<p align="center">
  <img src="./public/typeOwl.logo.png" alt="TypeOwl Logo" width="120" />
</p>

# TypeOwl Documentation Site & Example Frontend

A documentation website for TypeOwl with static HTML pages for SEO and a React app for interactive examples.

## 🦉 TypeOwl in Action

This frontend demonstrates TypeOwl's power features:

- **No monorepo required** — This frontend is in a separate folder but gets types from the backend
- **Types are committed** — Check `.typeowl/` — it's in the repo for independent deploys
- **Point to any backend** — Configure `typeowl.config.ts` to use local, staging, or production
- **On-demand sync** — Run `npx typeowl sync` whenever you want fresh types

## Structure

```
├── index.html              # Landing page (static HTML, SEO-optimized)
├── examples.html           # Examples page (React app entry)
├── public/
│   ├── docs/
│   │   └── index.html      # Documentation page (static HTML)
│   ├── engine/
│   │   └── index.html      # How It Works page (static HTML)
│   ├── typeOwl.logo.png    # Logo asset
│   └── owl.svg             # Favicon
├── src/
│   ├── App.tsx             # React app for interactive examples
│   ├── api/                # Type-safe API client
│   ├── components/         # UI components
│   └── main.tsx            # React entry point
└── vite.config.ts          # Vite configuration
```

## Pages

| Route | Type | Description |
|-------|------|-------------|
| `/` | Static HTML | Landing page with hero, features, and CTA |
| `/docs/index.html` | Static HTML | Full documentation with sidebar navigation |
| `/engine/index.html` | Static HTML | Technical deep-dive into how TypeOwl works |
| `/examples.html` | React App | Interactive API testing with live data |

## Why This Architecture?

- **SEO Optimized**: Landing, docs, and engine pages are static HTML with full meta tags
- **Fast Initial Load**: No JavaScript needed for static pages
- **Interactive Examples**: React handles the dynamic API testing functionality
- **Simple Deployment**: Works with any static hosting (Vercel, Netlify, GitHub Pages)

## Development

```bash
# Make sure backend is running first!
cd ../backend && npm install && npm run dev

# Then in a new terminal:
npm install
npm run dev
```

The site starts on `http://localhost:5173`:
- `http://localhost:5173/` - Landing page
- `http://localhost:5173/docs/index.html` - Documentation
- `http://localhost:5173/engine/index.html` - How It Works
- `http://localhost:5173/examples.html` - Interactive Examples

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Sync types and start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run typeowl:sync` | One-time type sync |
| `npm run typeowl:watch` | Watch for type changes |

## TypeOwl Configuration

```typescript
// typeowl.config.ts
import { defineConfig } from 'typeowl';

export default defineConfig({
  resolvers: [
    {
      name: 'api',
      // Point to local dev, staging, or production!
      source: process.env.TYPEOWL_API_URL || 'http://localhost:3001/__typeowl',
      // Or directly: 'https://api.yourcompany.com/__typeowl'
    },
  ],
  output: './.typeowl',   // Commit this for independent deploys!
  cache: './.typeowl-cache', // Gitignore this (local cache only)
});
```

## Deployment Strategy

This example demonstrates the **recommended approach**: committing types.

```bash
# .gitignore
.typeowl-cache/    # Only cache is gitignored
# .typeowl/ is committed for:
# ✅ CI/CD builds without backend access
# ✅ Independent frontend deploys
# ✅ Type changes visible in code reviews
```

## Adding New Static Pages

To add a new static page:

1. Create a folder in `public/` (e.g., `public/tutorials/`)
2. Add an `index.html` with full HTML structure
3. Include SEO meta tags, navigation, and footer
4. Update navigation links in all pages

The React app (examples.html) is only used for the interactive examples page.

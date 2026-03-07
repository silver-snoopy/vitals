# @vitals/frontend

React single-page application for visualizing health data and AI-generated reports.

## Tech Stack

- **React 18** with TypeScript
- **Vite 6** for build and dev server
- **Tailwind CSS 4** for styling
- **shadcn/ui** for UI components (planned)
- **Recharts** for data visualization (planned)
- **React Query** for server state management (planned)

## Scripts

```bash
npm run dev    # Start dev server (port 3000)
npm run build  # Build for production
npm run lint   # Run linter
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (default: `http://localhost:3001`) |

## Planned Pages (Phase 4)

| Route | Page | Key Components |
|-------|------|----------------|
| `/` | Dashboard | Weekly summary, nutrition/workout charts, latest AI report |
| `/nutrition` | Nutrition | Daily nutrition table, macro trend charts |
| `/workouts` | Workouts | Session list, exercise progress charts |
| `/reports` | Reports | AI report cards, insights, action items |
| `/upload` | Upload | Apple Health file uploader |

## Status

Scaffold only — full implementation in Phase 4.

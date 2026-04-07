# Client (React + Vite)

Frontend application for the Shantikunj multilingual workflow platform.

## Tech

- React
- Vite
- React Router
- Axios
- ESLint

## Setup

### 1) Install dependencies

```powershell
npm install
```

### 2) Start development server

```powershell
npm run dev
```

App URL: `http://localhost:5173`

## Backend Connection

API calls use `/api` as base URL in `src/api/axios.js`.

In local development, Vite proxy forwards `/api` to `http://localhost:5000` (see `vite.config.js`).

## Scripts

- `npm run dev` - start dev server
- `npm run build` - build production assets
- `npm run preview` - preview production build
- `npm run lint` - run ESLint

## Role-Based UI Areas

Main pages are grouped by role and workflow stage in `src/pages` and linked through routes in `src/App.jsx`.

Examples:

- dashboard and statistics views
- work queue and assignment management
- recorder upload and recorder history
- translator/checker feedback and task pages

## Folder Highlights

- `src/api` - API client setup
- `src/components` - reusable UI and guard components
- `src/context` - auth and theme providers
- `src/pages` - routed page modules

## Quality

- ESLint is configured via `eslint.config.js`.
- Current lint baseline is clean.

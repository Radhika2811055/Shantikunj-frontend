# Shantikunj Frontend

Frontend for the Shantikunj multilingual workflow platform.

## Overview

This repository contains the client application for LMS audiobook workflow operations with role-based routing and backend-integrated flows for auth, claims, uploads, review loops, support, notifications, feedback, and audit visibility.

## Tech Stack

- React
- Vite
- React Router
- Axios
- ESLint
- Vitest + Testing Library

## Environment Configuration

Runtime API configuration is strict and validated at startup.

Required variable:

- `VITE_API_BASE_URL`

Example `.env` for development:

```bash
VITE_API_BASE_URL=http://localhost:5000
```

Notes:

- The frontend automatically calls `${VITE_API_BASE_URL}/api/...`.
- If `VITE_API_BASE_URL` is missing or invalid, the app throws a clear startup error.

## Development Setup

1. Install dependencies

```bash
npm install
```

2. Set env file (`.env`) with `VITE_API_BASE_URL`

3. Start development server

```bash
npm run dev
```

Open `http://localhost:5173`.

## Production Setup

Build with production API base URL:

```bash
VITE_API_BASE_URL=https://your-api-host npm run build
```

Preview build:

```bash
npm run preview
```

## Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build production assets
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode

## Project Structure

- `src/api` - Centralized API client, error parsing, typed service modules
- `src/components` - Reusable components and route guards
- `src/context` - Auth and theme context
- `src/hooks` - Global API guards (unauthorized + in-flight cancel on route change)
- `src/pages` - Role-based pages and workflow screens
- `src/utils` - Upload validation helpers

## Integration Document

See `INTEGRATION.md` for:

- architecture changes
- endpoint mapping table
- env setup summary
- test checklist
- known limitations

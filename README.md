# Shantikunj Frontend

frontend for the Shantikunj multilingual workflow platform.

## Overview

This repository contains the client-side application for the Shantikunj LMS audiobook workflow system. It provides role-based pages for users, recorders, translators, checkers, and administrators.

## Tech Stack

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

Open `http://localhost:5173` in your browser.

## Backend Connection

- API requests use `/api` as the base path in `src/api/axios.js`.
- In development, the Vite proxy forwards `/api` to `http://localhost:5000`.
- See `vite.config.js` for proxy configuration.

## Scripts

- `npm run dev` - Start the Vite development server
- `npm run build` - Build production-ready assets
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint checks

## Application Structure

The main app routes and views are defined in `src/App.jsx`.

Key areas:

- `src/api` - Axios API client configuration
- `src/components` - Reusable components and route guards
- `src/context` - Authentication and theme providers
- `src/pages` - Page modules organized by workflow and role

## Role-Based UI Areas

The frontend supports:

- Dashboard and statistics pages
- Work queue and assignment management
- Recorder upload and recording history
- Translator and checker feedback workflows
- User and team management for admins

## Notes
- This project is intended to be paired with the Shantikunj backend API.


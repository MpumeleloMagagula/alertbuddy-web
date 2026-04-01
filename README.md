# Alert Buddy - Web Management Portal

Web-based management interface for Alert Buddy system.

## Features

- 👥 User Management - Add/remove users, assign roles
- 📊 Dashboard - System overview and statistics
- 🔔 Alert Testing - Send test alerts, view history
- 👔 Standby Management - Manage on-call schedule
- 📱 Device Management - View and manage registered devices

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Firebase (Auth + Firestore)
- Axios for API calls

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your Firebase credentials:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

4. Make sure your backend server is running on port 5000

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Page components
├── services/       # API and Firebase services
├── types/          # TypeScript type definitions
├── utils/          # Helper functions
└── App.tsx         # Main app component
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Environment Variables

See `.env.example` for required environment variables.

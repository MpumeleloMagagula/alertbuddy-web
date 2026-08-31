import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import { Toaster } from 'sonner';

// Contexts
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layout
import Layout from './components/layout/Layout';

// Pages — lazy-loaded so each route is its own chunk (cuts initial JS from ~2.3 MB to ~300 KB)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users     = lazy(() => import('./pages/Users'));
const Standby   = lazy(() => import('./pages/Standby'));
const Alerts    = lazy(() => import('./pages/Alerts'));
const Devices   = lazy(() => import('./pages/Devices'));
const AuditLog  = lazy(() => import('./pages/AuditLog'));
const Settings  = lazy(() => import('./pages/Settings'));
import Login from './pages/Login';

function AppRoutes() {
  const { loading, isAuthenticated, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto shadow-lg shadow-primary-500/20"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Initializing Alert Buddy...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />

        <Route
          path="/"
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={isAdmin ? <Users /> : <Navigate to="/" replace />} />
          <Route path="standby" element={<Standby />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="devices" element={<Devices />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

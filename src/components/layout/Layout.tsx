import { useEffect, useRef, useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { WifiOff, X } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import firebase from '../../services/firebase';
import { playAlertSound, isSoundEnabled } from '../../utils/soundAlerts';
import { showAlertNotification } from '../../utils/browserNotifications';

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function Layout() {
  const lastAlertTimeRef = useRef<number>(Date.now());
  const [firestoreWarning, setFirestoreWarning] = useState(false);

  useEffect(() => {
    // Listen for new alerts globally to play sound
    const unsubscribe = firebase.onAlertsChange((alerts) => {
      if (alerts.length > 0) {
        const mostRecentAlert = alerts[0];
        if (mostRecentAlert.timestamp > lastAlertTimeRef.current) {
          if (isSoundEnabled()) playAlertSound(mostRecentAlert.severity);
          showAlertNotification(mostRecentAlert.title, mostRecentAlert.body);
          lastAlertTimeRef.current = mostRecentAlert.timestamp;
        }
      }
    }, 1);

    // Show a banner if any Firestore listener errors (e.g. blocked by ad blocker)
    const onBlocked = () => setFirestoreWarning(true);
    window.addEventListener('firestore-blocked', onBlocked);

    return () => { unsubscribe(); window.removeEventListener('firestore-blocked', onBlocked); };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {/* Firestore blocked warning — only appears when browser blocks real-time connection */}
        {firestoreWarning && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 flex items-center justify-between gap-3 text-sm text-yellow-800 dark:text-yellow-300">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span>Real-time updates paused — a browser extension may be blocking the connection. Data is loaded from the server instead.</span>
            </div>
            <button
              type="button"
              onClick={() => setFirestoreWarning(false)}
              aria-label="Dismiss"
              className="flex-shrink-0 p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-800/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Suspense covers lazy-loaded page chunks */}
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

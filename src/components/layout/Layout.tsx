import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import firebase from '../../services/firebase';
import { playAlertSound } from '../../utils/soundAlerts';

export default function Layout() {
  const lastAlertTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Listen for new alerts globally to play sound
    const unsubscribe = firebase.onAlertsChange((alerts) => {
      if (alerts.length > 0) {
        const mostRecentAlert = alerts[0];
        
        // Only play sound if alert is newer than when we loaded the page
        // and if it's not already read (though new alerts shouldn't be read)
        if (mostRecentAlert.timestamp > lastAlertTimeRef.current) {
          playAlertSound(mostRecentAlert.severity);
          lastAlertTimeRef.current = mostRecentAlert.timestamp;
        }
      }
    }, 1);

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header />
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

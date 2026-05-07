import { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import firebase from '../../services/firebase';
import ThemeToggle from '../common/ThemeToggle';

export default function Header() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const currentUser = firebase.getCurrentUser();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await firebase.logout();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="h-16 bg-card border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 transition-colors duration-200">
      {/* Page title - can be customized per page */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          <span className="text-primary-600">Altron</span> Portal
        </h2>
      </div>

      {/* User info and actions */}
      <div className="flex items-center gap-6">
        <ThemeToggle />
        
        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-primary-700 dark:text-primary-400" />
          </div>
          <div className="text-sm hidden md:block">
            <p className="font-semibold text-gray-900 dark:text-white leading-none">
              {currentUser?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Administrator</p>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
}

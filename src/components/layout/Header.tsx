import { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import firebase from '../../services/firebase';

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
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Page title - can be customized per page */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Management Portal</h2>
      </div>

      {/* User info and actions */}
      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary-700" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-900">
              {currentUser?.email || 'User'}
            </p>
            <p className="text-gray-500 text-xs">Administrator</p>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </header>
  );
}

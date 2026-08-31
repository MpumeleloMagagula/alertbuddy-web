import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import firebase from '../services/firebase';
import api from '../services/api';
import type { UserRole } from '../types';

interface AuthState {
  /** true until the first auth state + role resolution completes */
  loading: boolean;
  user: FirebaseUser | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  isManager: boolean; // MANAGER or ADMIN
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  user: null,
  isAuthenticated: false,
  role: null,
  isManager: false,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    return firebase.onAuthChange(async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const me = await api.getMe();
        setRole(me.role as UserRole);
      } catch {
        setRole('USER' as UserRole); // safe default — backend still enforces
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value: AuthState = {
    loading,
    user,
    isAuthenticated: !!user,
    role,
    isManager: role === 'ADMIN' || role === 'MANAGER',
    isAdmin: role === 'ADMIN',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

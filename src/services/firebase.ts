import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { User, Alert, TeamMember, HandoverLog } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class FirebaseService {
  private _firestoreBlockedNotified = false;

  private _notifyBlocked() {
    if (this._firestoreBlockedNotified) return;
    this._firestoreBlockedNotified = true;
    window.dispatchEvent(new CustomEvent('firestore-blocked'));
  }

  // ========== Authentication ==========
  async login(email: string, password: string): Promise<FirebaseUser> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }

  onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  // ========== Users (Firestore) ==========
  async getUsers(): Promise<User[]> {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  }

  onUsersChange(callback: (users: User[]) => void): () => void {
    const usersRef = collection(db, 'users');
    return onSnapshot(usersRef, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      callback(users);
    }, (error) => {
      console.error('Error listening to users:', error);
      this._notifyBlocked();
      callback([]);
    });
  }

  async createUser(userData: Omit<User, 'id'>): Promise<string> {
    const usersRef = collection(db, 'users');
    const docRef = await addDoc(usersRef, userData);
    return docRef.id;
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, userData);
  }

  async deleteUser(userId: string): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
  }

  // ========== Alerts (Firestore) ==========
  async getAlerts(limitCount: number = 50): Promise<Alert[]> {
    const alertsRef = collection(db, 'alerts');
    const q = query(alertsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
  }

  onAlertsChange(callback: (alerts: Alert[]) => void, limitCount: number = 50): () => void {
    const alertsRef = collection(db, 'alerts');
    const q = query(alertsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      callback(alerts);
    }, (error) => {
      console.error('Error listening to alerts:', error);
      this._notifyBlocked();
      callback([]);
    });
  }

  async getUnreadAlerts(): Promise<Alert[]> {
    const alertsRef = collection(db, 'alerts');
    const q = query(alertsRef, where('isRead', '==', false), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
  }

  // ========== Team Members (Firestore) ==========
  async getTeamMembers(): Promise<TeamMember[]> {
    const teamRef = collection(db, 'team_members');
    const snapshot = await getDocs(teamRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember));
  }

  onTeamMembersChange(callback: (members: TeamMember[]) => void): () => void {
    const teamRef = collection(db, 'team_members');
    return onSnapshot(teamRef, (snapshot) => {
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember));
      callback(members);
    }, (error) => {
      console.error('Error listening to team members:', error);
      this._notifyBlocked();
      callback([]);
    });
  }

  async updateTeamMember(memberId: string, memberData: Partial<TeamMember>): Promise<void> {
    const memberRef = doc(db, 'team_members', memberId);
    await updateDoc(memberRef, memberData);
  }

  // ========== Handover Logs (Firestore) ==========
  async getHandoverLogs(limitCount: number = 20): Promise<HandoverLog[]> {
    const logsRef = collection(db, 'handover_logs');
    const q = query(logsRef, orderBy('handoverAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HandoverLog));
  }

  onHandoverLogsChange(callback: (logs: HandoverLog[]) => void, limitCount: number = 20): () => void {
    const logsRef = collection(db, 'handover_logs');
    const q = query(logsRef, orderBy('handoverAt', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HandoverLog));
      callback(logs);
    }, (error) => {
      console.error('Error listening to handover logs:', error);
      this._notifyBlocked();
      callback([]);
    });
  }

  // ========== Audit Logs (Firestore) ==========
  onAuditLogsChange(callback: (logs: any[]) => void, limitCount: number = 100): () => void {
    const logsRef = collection(db, 'audit_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(logs);
    }, (error) => {
      console.error('Error listening to audit logs:', error);
      this._notifyBlocked();
      callback([]);
    });
  }

  // ========== Standby (Firestore real-time) ==========
  onStandbyChange(callback: (standby: any) => void): () => void {
    const ref = doc(db, 'standby', 'current');
    return onSnapshot(ref, (snap) => {
      callback(snap.exists() ? snap.data() : { onStandby: false, tokenResolved: false });
    }, (error) => {
      console.error('Error listening to standby:', error);
      // Call callback with empty state so callers don't get stuck waiting
      callback({ onStandby: false, tokenResolved: false });
    });
  }

  // ========== Devices (Firestore) ==========
  onDevicesChange(callback: (devices: any[]) => void): () => void {
    const devicesRef = collection(db, 'devices');
    return onSnapshot(devicesRef, (snapshot) => {
      const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(devices);
    }, (error) => {
      console.error('Error listening to devices:', error);
      this._notifyBlocked();
      callback([]);
    });
  }
}

export default new FirebaseService();

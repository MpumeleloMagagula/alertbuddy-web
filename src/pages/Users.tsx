import { useState, useEffect, useMemo } from 'react';
import { Users as UsersIcon, Plus, Edit, Trash2, Shield, Search } from 'lucide-react';
import { toast } from 'sonner';
import firebase from '../services/firebase';
import { UserRole } from '../types';
import type { User } from '../types';

const ROLE_FILTERS: Array<UserRole | 'ALL'> = ['ALL', UserRole.ADMIN, UserRole.MANAGER, UserRole.USER];

const ROLE_PILL: Record<string, string> = {
  ALL:                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
  [UserRole.ADMIN]:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60',
  [UserRole.MANAGER]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60',
  [UserRole.USER]:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60',
};

const ROLE_PILL_ACTIVE: Record<string, string> = {
  ALL:                'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900',
  [UserRole.ADMIN]:   'bg-red-600 text-white dark:bg-red-500',
  [UserRole.MANAGER]: 'bg-blue-600 text-white dark:bg-blue-500',
  [UserRole.USER]:    'bg-green-600 text-white dark:bg-green-500',
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 5000);
    const unsubscribe = firebase.onUsersChange((updatedUsers) => {
      setUsers(updatedUsers);
      setIsLoading(false);
      clearTimeout(timeout);
    });
    return () => { unsubscribe(); clearTimeout(timeout); };
  }, []);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (roleFilter !== 'ALL') list = list.filter(u => u.role === roleFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, roleFilter, searchQuery]);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await firebase.deleteUser(userId);
      toast.success('User deleted successfully');
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':   return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50';
      case 'MANAGER': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
      default:        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto shadow-sm" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alert Users</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage user accounts and permissions</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Admins</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{users.filter(u => u.role === 'ADMIN').length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Managers</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{users.filter(u => u.role === 'MANAGER').length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{users.filter(u => u.isActive).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Role pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {ROLE_FILTERS.map(role => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                roleFilter === role ? ROLE_PILL_ACTIVE[role] : ROLE_PILL[role]
              }`}
            >
              {role === 'ALL' ? 'All Roles' : role}
              <span className="ml-1.5 opacity-70">
                {role === 'ALL'
                  ? users.length
                  : users.filter(u => u.role === role).length}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email or department…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
      </div>

      {/* Users table */}
      <div className="card">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <UsersIcon className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
            {users.length === 0 ? (
              <>
                <p>No users found</p>
                <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary mt-4">
                  Add Your First User
                </button>
              </>
            ) : (
              <p>No users match the current filter</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredUsers.length}</span> of{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-300">{users.length}</span> users
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    {['Name', 'Email', 'Role', 'Department', 'Status', 'Created', 'Actions'].map((h, i) => (
                      <th
                        key={h}
                        className={`py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 ${i === 6 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900 dark:text-white">{user.displayName}</p>
                        {user.position && <p className="text-xs text-gray-500 dark:text-gray-400">{user.position}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${getRoleBadgeColor(user.role)}`}>{user.role}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{user.department || '-'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${user.isActive ? 'badge-success' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            className="text-primary-600 hover:text-primary-700 p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Info box */}
      <div className="card bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/50">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-primary-900 dark:text-primary-300">
            <p className="font-semibold mb-1 text-primary-950 dark:text-primary-200">User Roles Explained</p>
            <ul className="space-y-1 list-disc list-inside text-primary-800 dark:text-primary-400">
              <li><strong>Admin:</strong> Full system access, can manage all users and settings</li>
              <li><strong>Manager:</strong> Can manage team members, shifts, and view all alerts</li>
              <li><strong>User:</strong> Can receive alerts and participate in standby rotation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              User management forms will be implemented with Firebase Authentication integration.
            </p>
            <button
              type="button"
              onClick={() => { setShowAddModal(false); setEditingUser(null); }}
              className="btn-secondary w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Edit, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import firebase from '../services/firebase';
import type { User, UserRole } from '../types';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    // Fallback timeout in case Firebase is blocked by an adblocker (ERR_BLOCKED_BY_CLIENT)
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    // Subscribe to real-time updates
    const unsubscribe = firebase.onUsersChange((updatedUsers) => {
      setUsers(updatedUsers);
      setIsLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await firebase.deleteUser(userId);
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
      case 'USER':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto shadow-sm"></div>
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
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
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
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {users.filter(u => u.role === 'ADMIN').length}
              </p>
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
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {users.filter(u => u.role === 'MANAGER').length}
              </p>
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
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {users.filter(u => u.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="card">
        {users.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <UsersIcon className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
            <p>No users found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary mt-4"
            >
              Add Your First User
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Department</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Created</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 dark:text-white">{user.displayName}</p>
                      {user.position && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.position}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
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
                          onClick={() => setEditingUser(user)}
                          className="text-primary-600 hover:text-primary-700 p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
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
        )}
      </div>

      {/* Info box */}
      <div className="card bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/50">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
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

      {/* Add/Edit User Modal - Placeholder */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              User management forms will be implemented with Firebase Authentication integration.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                }}
                className="btn-secondary flex-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

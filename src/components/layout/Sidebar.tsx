import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserCheck, Bell, Smartphone, ClipboardList } from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/standby', icon: UserCheck, label: 'Standby' },
    { to: '/alerts', icon: Bell, label: 'Alerts' },
    { to: '/devices', icon: Smartphone, label: 'Devices' },
    { to: '/audit-log', icon: ClipboardList, label: 'Audit Log' },
  ];

  return (
    <aside className="w-64 bg-card border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-200">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/30 overflow-hidden p-1">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">Alert Buddy</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Management Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          <p>Alert Buddy v2.0.0</p>
          <p className="mt-1 font-semibold text-primary-600 dark:text-primary-400">Alert</p>
        </div>
      </div>
    </aside>
  );
}

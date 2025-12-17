'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { removeAuthToken, getAuthToken } from '@/lib/auth';
import api from '@/lib/api';
import Menu from './Menu';
import { 
  LayoutDashboard, 
  Calendar, 
  FileText, 
  Users, 
  Settings, 
  LogOut,
  Menu as MenuIcon,
  X,
  CheckSquare,
  UserCircle,
  Shield,
  ChevronDown
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Apply Leave', href: '/dashboard/apply-leave', icon: FileText },
  { name: 'My Leaves', href: '/dashboard/leaves', icon: CheckSquare },
  { name: 'Authorizations', href: '/dashboard/authorizations', icon: UserCircle },
  { name: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
  { name: 'Approvals', href: '/dashboard/approvals', icon: CheckSquare },
  { name: 'Employees', href: '/dashboard/employees', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// Admin-only navigation items
const adminNavigation = [
  { name: 'Manage Authorizations', href: '/dashboard/manage-authorizations', icon: UserCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Load sidebar state from localStorage, default to true for desktop, false for mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarOpen');
      if (saved !== null) {
        return saved === 'true';
      }
      // Default: open on desktop (lg screens), closed on mobile
      return window.innerWidth >= 1024;
    }
    return false;
  });
  
  const [imageError, setImageError] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarOpen', sidebarOpen.toString());
    }
  }, [sidebarOpen]);

  useEffect(() => {
    fetchUser();
    
    // Refresh user data when page becomes visible (e.g., after editing employee)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUser();
      }
    };

    const handleFocus = () => {
      fetchUser();
    };

    // Listen for storage events (when user data is updated in another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_updated') {
        fetchUser();
        // Clear the flag
        localStorage.removeItem('user_updated');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const fetchUser = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        // Check if we're on calendar page - don't redirect
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        if (currentPath.includes('/calendar')) {
          setLoading(false);
          return;
        }
        window.location.href = '/login';
        return;
      }
      
      const response = await api.get('/Auth/Me');
      
      if (response.data && response.data.user) {
        setUser(response.data.user);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      // Check if we're on calendar page - don't redirect
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const isCalendarPage = currentPath.includes('/calendar');
      
      if (isCalendarPage) {
        setLoading(false);
        return;
      }
      
      removeAuthToken();
      
      // Only redirect if it's an auth error and not on calendar page
      if (error.response?.status === 401 || error.response?.status === 403) {
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-blue-50 border-r border-gray-200 shadow-sm transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section - Fixed at top */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 flex-shrink-0">
            {/* Menu icon lines - Toggle sidebar */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-600 hover:text-gray-900 transition-colors flex items-center p-1"
              aria-label="Toggle sidebar"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            {/* Consultare text/logo */}
            {!imageError ? (
              <Image
                src="/consultare-logo.png"
                alt="Consultare Logo"
                width={120}
                height={35}
                className="object-contain"
                priority
                unoptimized
                onError={() => {
                  console.error('Logo image failed to load');
                  setImageError(true);
                }}
              />
            ) : (
              <h1 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Consultare
              </h1>
            )}
          </div>
          {/* Border line below logo - same as header line */}
          <div className="border-b border-gray-200"></div>

          {/* Navigation - Scrollable with visible scrollbar */}
          <nav 
            className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden sidebar-scroll"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 #f1f5f9'
            }}
          >
            <Menu userRole={user?.role} />
            
            {/* Additional menu items */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/dashboard/calendar"
                className={`flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  pathname === '/dashboard/calendar'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                <Calendar className={`w-5 h-5 mr-3 ${pathname === '/dashboard/calendar' ? 'text-white' : 'text-gray-500'}`} />
                <span>Calendar</span>
              </Link>
              
              {/* Authorizations - Only for Admin and HOD */}
              {(user?.role === 'admin' || user?.role === 'hod' || user?.role === 'HOD') && (
                <Link
                  href="/dashboard/authorizations"
                  className={`flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                    pathname === '/dashboard/authorizations'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  <UserCircle className={`w-5 h-5 mr-3 ${pathname === '/dashboard/authorizations' ? 'text-white' : 'text-gray-500'}`} />
                  <span>Authorizations</span>
                </Link>
              )}

              {(user?.role === 'admin' || user?.role === 'Admin') && (
                <Link
                  href="/dashboard/manage-authorizations"
                  className={`flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                    pathname === '/dashboard/manage-authorizations'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  <Shield className={`w-5 h-5 mr-3 ${pathname === '/dashboard/manage-authorizations' ? 'text-white' : 'text-gray-500'}`} />
                  <span>Manage Authorizations</span>
                </Link>
              )}

              <Link
                href="/dashboard/settings"
                className={`flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  pathname === '/dashboard/settings'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                <Settings className={`w-5 h-5 mr-3 ${pathname === '/dashboard/settings' ? 'text-white' : 'text-gray-500'}`} />
                <span>Settings</span>
              </Link>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        {/* Top bar */}
        <header className="bg-blue-50 border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            {/* Show menu icon in header only when sidebar is closed */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Open sidebar"
              >
                <MenuIcon className="w-6 h-6" />
              </button>
            )}
            {sidebarOpen && <div></div>}
            <div className="flex-1"></div>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                <UserCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span className="font-medium hidden md:inline whitespace-nowrap">{user?.full_name || user?.email || 'User'}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-blue-50 rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {user?.full_name || user?.email || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{user?.email || ''}</p>
                      <p className="text-xs text-gray-600 capitalize mt-1">{user?.role || 'employee'}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

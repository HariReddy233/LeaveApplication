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
        // Only redirect if not already on login page to avoid redirect loop
        if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
          window.location.href = '/login';
        }
        return;
      }
      
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get('/Auth/Me').catch((err) => {
          // If Auth/Me fails with 401, it's a real auth issue
          if (err.response?.status === 401) {
            throw err;
          }
          // For other errors, return a safe default
          return { data: { user: null } };
        }),
        api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } }))
      ]);
      
      if (userResponse.data && userResponse.data.user) {
        const userData = {
          ...userResponse.data.user,
          permissions: permissionsResponse.data?.data || []
        };
        setUser(userData);
      } else {
        // User data not available but token exists - might be a temporary issue
        // Don't redirect immediately, just log and continue
        console.warn('User data not available, but token exists');
        setLoading(false);
      }
    } catch (error: any) {
      // Check if we're on calendar page - don't redirect
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const isCalendarPage = currentPath.includes('/calendar');
      
      if (isCalendarPage) {
        setLoading(false);
        return;
      }
      
      // Only redirect on 401 (unauthorized) - not on 403 (forbidden)
      // 403 means user is authenticated but doesn't have permission
      if (error.response?.status === 401) {
        removeAuthToken();
        // Only redirect if not already on login page to avoid redirect loop
        if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
          window.location.href = '/login';
        }
      } else {
        // For other errors (403, network errors, etc.), don't redirect
        // Just log and continue - user might still be authenticated
        console.error('Error fetching user data:', error);
        setLoading(false);
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
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section - Fixed at top */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 flex-shrink-0">
            {/* Hamburger menu - 3 lines icon */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-600 hover:text-gray-900 transition-colors flex flex-col gap-1 p-1"
              aria-label="Toggle sidebar"
            >
              <div className="w-5 h-0.5 bg-gray-600"></div>
              <div className="w-5 h-0.5 bg-gray-600"></div>
              <div className="w-5 h-0.5 bg-gray-600"></div>
            </button>
            {/* Consultare text/logo - Reduced size */}
            {!imageError ? (
              <Image
                src="/consultare-logo.png"
                alt="Consultare Logo"
                width={100}
                height={28}
                className="object-contain"
                priority
                unoptimized
                onError={() => {
                  console.error('Logo image failed to load');
                  setImageError(true);
                }}
              />
            ) : (
              <h1 className="text-base font-semibold text-gray-900">
                Consultare
              </h1>
            )}
          </div>
          {/* Horizontal divider line below logo - consistent width and alignment */}
          <div className="border-b border-gray-200 mx-6"></div>

          {/* Navigation - Scrollable with visible scrollbar */}
          <nav 
            className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden sidebar-scroll"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 #f1f5f9'
            }}
          >
            <Menu userRole={user?.role} userPermissions={user?.permissions} />
            
            {/* Additional menu items - Below the line */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {/* Manage Authorizations - Admin only */}
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

              {/* Settings - Show only if user has settings.view permission or is Admin */}
              {(user?.role === 'admin' || user?.role === 'Admin' || (user?.permissions && user.permissions.includes('settings.view'))) && (
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
              )}
            </div>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 w-full ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
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
              {/* Horizontal divider line below user profile - consistent width and alignment */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full w-full border-b border-gray-200 mt-2"></div>
              )}

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

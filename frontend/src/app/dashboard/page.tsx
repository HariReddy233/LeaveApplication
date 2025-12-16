'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Calendar, FileCheck, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, Users, Shield } from 'lucide-react';
import Link from 'next/link';
import DateFormatter from '@/utils/DateFormatter';
import classNames from 'classnames';

export default function DashboardPage() {
  const router = useRouter();
  const [summaryData, setSummaryData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [recentLeaves, setRecentLeaves] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch user info and dashboard data in parallel for faster loading
      const userResponse = await api.get('/Auth/Me');
      if (userResponse.data && userResponse.data.user) {
        setUser(userResponse.data.user);
        const role = userResponse.data.user.role?.toLowerCase();

        // Fetch all data in parallel
        const currentYear = new Date().getFullYear();
        const isAdmin = role === 'admin' || role === 'Admin';
        const isHod = role === 'hod' || role === 'HOD';
        
        const promises = [
          isAdmin 
            ? api.get('/Dashboard/DashboardSummaryAdmin')
            : isHod
            ? api.get('/Dashboard/DashboardSummaryHod')
            : api.get('/Dashboard/DashboardSummaryEmployee'),
          api.get(`/Leave/LeaveList/1/5/0`, { params: { year: currentYear } })
        ];

        // Fetch pending approvals for Admin and HOD
        if (isAdmin || isHod) {
          promises.push(
            isAdmin 
              ? api.get('/Leave/LeaveAdminList/1/100/0')
              : api.get('/Leave/LeaveListHod/1/100/0')
          );
        }

        const responses = await Promise.all(promises);
        const [summaryResponse, leavesResponse, approvalsResponse] = responses;

        if (summaryResponse.data) {
          setSummaryData(summaryResponse.data);
        }
        
        if (leavesResponse.data?.Data) {
          setRecentLeaves(leavesResponse.data.Data.slice(0, 5));
        }

        // Filter pending approvals based on role
        if (approvalsResponse?.data?.Data) {
          const allLeaves = approvalsResponse.data.Data;
          const pending = allLeaves.filter((l: any) => {
            const hodStatus = l.hod_status || l.HodStatus || 'Pending';
            const adminStatus = l.admin_status || l.AdminStatus || 'Pending';
            
            // For HOD: show leaves where HOD status is pending
            // For Admin: show leaves where Admin status is pending
            if (isHod) {
              return hodStatus === 'Pending';
            } else if (isAdmin) {
              return adminStatus === 'Pending';
            }
            return false;
          });
          setPendingApprovals(pending.slice(0, 5)); // Show top 5 pending
        }
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600 text-sm">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const totalLeave = summaryData?.Total?.[0]?.count || 0;
  const summaryLists = summaryData?.Data || [];
  
  // Ensure we have all status types with default values
  const pendingCount = summaryLists.find((s: any) => s._id === 'Pending')?.count || 0;
  const approvedCount = summaryLists.find((s: any) => s._id === 'Approved')?.count || 0;
  const rejectedCount = summaryLists.find((s: any) => s._id === 'Rejected')?.count || 0;

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isHod = user?.role?.toLowerCase() === 'hod';
  const isAdminOrHod = isAdmin || isHod;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'User'}! Welcome back.
          </p>
        </div>
        {!isAdminOrHod && (
          <Link
            href="/dashboard/apply-leave"
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-all"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Apply for Leave
          </Link>
        )}
      </div>

      {/* Statistics Cards - Compact Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Leave */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-4 shadow-sm hover:shadow transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/60 p-2 rounded-md">
              <FileCheck className="w-4 h-4 text-blue-600" />
            </div>
            <TrendingUp className="w-3 h-3 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-0.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Total Leaves
            </p>
            <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {totalLeave}
            </h3>
          </div>
        </div>

        {/* Pending Leave */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200 p-4 shadow-sm hover:shadow transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/60 p-2 rounded-md">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <AlertCircle className="w-3 h-3 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-0.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Pending
            </p>
            <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {pendingCount}
            </h3>
          </div>
        </div>

        {/* Approved Leave */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-4 shadow-sm hover:shadow transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/60 p-2 rounded-md">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <TrendingUp className="w-3 h-3 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-0.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Approved
            </p>
            <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {approvedCount}
            </h3>
          </div>
        </div>

        {/* Rejected Leave */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200 p-4 shadow-sm hover:shadow transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/60 p-2 rounded-md">
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <AlertCircle className="w-3 h-3 text-red-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-0.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Rejected
            </p>
            <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {rejectedCount}
            </h3>
          </div>
        </div>
      </div>

      {/* Pending Approvals Section - Only for Admin and HOD - Simple Count Only */}
      {isAdminOrHod && pendingApprovals.length > 0 && (
        <Link
          href="/dashboard/approvals"
          className="block bg-white rounded-lg border border-amber-300 shadow-sm hover:border-amber-400 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  Pending Leave Approvals
                </h2>
                <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {pendingApprovals.length} leave request{pendingApprovals.length > 1 ? 's' : ''} awaiting your {isAdmin ? 'admin' : 'HOD'} approval
                </p>
              </div>
            </div>
            <div className="text-blue-600">
              <span className="text-lg">→</span>
            </div>
          </div>
        </Link>
      )}

      {/* Quick Actions - Only for Employees */}
      {!isAdminOrHod && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/dashboard/apply-leave"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  Apply for Leave
                </h3>
                <p className="text-xs text-gray-600" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  Submit a new leave request
                </p>
              </div>
              <div className="bg-blue-50 p-2.5 rounded-lg">
                <Plus className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/calendar"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-green-400 hover:bg-green-50 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  View Calendar
                </h3>
                <p className="text-xs text-gray-600" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  Check leave calendar
                </p>
              </div>
              <div className="bg-green-50 p-2.5 rounded-lg">
                <Calendar className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/leaves"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-400 hover:bg-gray-50 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  My Leaves
                </h3>
                <p className="text-xs text-gray-600" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  View all my leaves
                </p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <FileCheck className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Admin/HOD Quick Actions */}
      {isAdminOrHod && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/dashboard/approvals"
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  Approvals
                </h3>
                <p className="text-xs text-gray-600" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  Review and approve leave requests
                </p>
              </div>
              <div className="bg-blue-50 p-2.5 rounded-lg">
                <CheckCircle className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </Link>

          {isAdmin && (
            <Link
              href="/dashboard/employees"
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-green-400 hover:bg-green-50 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    Employees
                  </h3>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    Manage employees
                  </p>
                </div>
                <div className="bg-green-50 p-2.5 rounded-lg">
                  <Users className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </Link>
          )}

          <Link
            href={isAdmin ? "/dashboard/leaves-admin" : "/dashboard/leaves-hod"}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-400 hover:bg-gray-50 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  All Leaves
                </h3>
                <p className="text-xs text-gray-600" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  View all leave applications
                </p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <FileCheck className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Recent Leave Applications */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            Recent Leave Applications
          </h2>
          <Link
            href={isAdminOrHod ? (isAdmin ? "/dashboard/leaves-admin" : "/dashboard/leaves-hod") : "/dashboard/leaves"}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            View All
            <span className="text-sm">→</span>
          </Link>
        </div>
        <div className="p-4">
          {recentLeaves.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700 uppercase">Leave Type</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700 uppercase">Application Date</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700 uppercase">Days</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700 uppercase">HOD Status</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-700 uppercase">Admin Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeaves.map((leave: any, index: number) => (
                    <tr key={leave.id || leave._id || index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 text-xs font-medium text-gray-900">{leave.LeaveType || leave.leave_type || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">
                        <DateFormatter date={leave.createdAt || leave.created_at} />
                      </td>
                      <td className="py-2.5 px-3 text-xs font-semibold text-gray-900">{leave.NumOfDay || leave.number_of_days || 'N/A'}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={classNames('px-2 py-1 rounded text-xs font-medium', {
                            'bg-green-100 text-green-700': (leave.HodStatus || leave.hod_status) === 'Approved',
                            'bg-yellow-100 text-yellow-700': (leave.HodStatus || leave.hod_status) === 'Pending',
                            'bg-red-100 text-red-700': (leave.HodStatus || leave.hod_status) === 'Rejected',
                          })}
                        >
                          {leave.HodStatus || leave.hod_status || 'Pending'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={classNames('px-2 py-1 rounded text-xs font-medium', {
                            'bg-green-100 text-green-700': (leave.AdminStatus || leave.admin_status) === 'Approved',
                            'bg-yellow-100 text-yellow-700': (leave.AdminStatus || leave.admin_status) === 'Pending',
                            'bg-red-100 text-red-700': (leave.AdminStatus || leave.admin_status) === 'Rejected',
                          })}
                        >
                          {leave.AdminStatus || leave.admin_status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <FileCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4 text-sm" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                No leave applications found
              </p>
              {!isAdminOrHod && (
                <Link
                  href="/dashboard/apply-leave"
                  className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-blue-700 transition-all"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Apply for Leave
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

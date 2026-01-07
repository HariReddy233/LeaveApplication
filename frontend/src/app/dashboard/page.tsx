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
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get('/Auth/Me').catch((err) => {
          // If Auth/Me fails with 401, it's a real auth issue - let interceptor handle it
          if (err.response?.status === 401) {
            throw err;
          }
          // For other errors, return null to prevent redirect loop
          return { data: { user: null } };
        }),
        api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } }))
      ]);
      
      if (userResponse.data && userResponse.data.user) {
        setUser(userResponse.data.user);
        const role = userResponse.data.user.role?.toLowerCase();
        
        // Check dashboard.view permission
        // Admin can access dashboard without explicit permission (admin has full access)
        const permissions = permissionsResponse.data?.data || [];
        const hasDashboardView = permissions.some((p: string) => p === 'dashboard.view');
        const isAdmin = role === 'admin' || role === 'Admin';
        const isHod = role === 'hod' || role === 'HOD';
        
        // If user doesn't have dashboard.view permission and is not admin, redirect
        if (!hasDashboardView && !isAdmin) {
          router.push('/dashboard/apply-leave');
          return;
        }

        // Fetch all data in parallel
        const currentYear = new Date().getFullYear();
        
        const promises = [
          isAdmin 
            ? api.get('/Dashboard/DashboardSummaryAdmin')
            : isHod
            ? api.get('/Dashboard/DashboardSummaryHod')
            : api.get('/Dashboard/DashboardSummaryEmployee'),
          // Use correct endpoint based on role for recent leaves
          (isAdmin 
            ? api.get('/Leave/LeaveAdminList/1/5/0')
            : isHod
            ? api.get('/Leave/LeaveListHod/1/5/0')
            : api.get(`/Leave/LeaveList/1/5/0`, { params: { year: currentYear } }))
            .catch((err: any) => {
              // If 403 (permission denied), return empty data instead of throwing
              if (err.response?.status === 403) {
                return { data: { Data: [] } };
              }
              // For other errors, still throw to be caught by outer catch
              throw err;
            })
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
      // Only redirect on 401 (unauthorized) - not on 403 (forbidden)
      // 403 means user is authenticated but doesn't have permission
      // Let the API interceptor handle 401 redirects to avoid loops
      if (error.response?.status === 401) {
        // Don't redirect here - let the API interceptor handle it
        // This prevents redirect loops
        console.error('Authentication error:', error);
      } else {
        // For other errors (403, network errors, etc.), just log
        console.error('Error fetching dashboard data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-100 border-t-blue-600 mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="text-gray-600 text-sm font-medium">Loading dashboard...</div>
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
    <div className="page-container space-y-5 max-w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="space-y-0.5">
          <h1 className="text-xl font-medium text-gray-900">
            Dashboard
          </h1>
          <p className="text-xs text-gray-600">
            {getGreeting()}, <span className="text-gray-900">{user?.full_name?.split(' ')[0] || 'User'}</span>! Welcome back.
          </p>
        </div>
        {!isAdminOrHod && (
          <Link
            href="/dashboard/apply-leave"
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-300 to-blue-400 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:from-blue-400 hover:to-blue-500 transition-all duration-200 shadow-sm hover:shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Apply for Leave
          </Link>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Leave */}
        <Link
          href={isAdmin ? "/dashboard/leaves-admin" : isHod ? "/dashboard/leaves-hod" : "/dashboard/leaves"}
          className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-gradient-to-br from-blue-200 to-blue-300 p-2.5 rounded-lg">
                <FileCheck className="w-4 h-4 text-blue-600" />
              </div>
              <TrendingUp className="w-3.5 h-3.5 text-blue-300 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <p className="text-xs font-normal text-gray-500 mb-1 uppercase tracking-wide">
                Total Leaves
              </p>
              <h3 className="text-2xl font-semibold text-gray-900 mb-0.5">
                {totalLeave}
              </h3>
              <div className="h-0.5 w-8 bg-gradient-to-r from-blue-200 to-blue-300 rounded-full mt-1"></div>
            </div>
          </div>
        </Link>

        {/* Pending Leave */}
        <Link
          href={`${isAdmin ? "/dashboard/leaves-admin" : isHod ? "/dashboard/leaves-hod" : "/dashboard/leaves"}?status=Pending`}
          className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/30 via-amber-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-gradient-to-br from-amber-200 to-amber-300 p-2.5 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <AlertCircle className="w-3.5 h-3.5 text-amber-300 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <p className="text-xs font-normal text-gray-500 mb-1 uppercase tracking-wide">
                Pending
              </p>
              <h3 className="text-2xl font-semibold text-gray-900 mb-0.5">
                {pendingCount}
              </h3>
              <div className="h-0.5 w-8 bg-gradient-to-r from-amber-200 to-amber-300 rounded-full mt-1"></div>
            </div>
          </div>
        </Link>

        {/* Approved Leave */}
        <Link
          href={`${isAdmin ? "/dashboard/leaves-admin" : isHod ? "/dashboard/leaves-hod" : "/dashboard/leaves"}?status=Approved`}
          className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 via-emerald-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-gradient-to-br from-emerald-200 to-emerald-300 p-2.5 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <p className="text-xs font-normal text-gray-500 mb-1 uppercase tracking-wide">
                Approved
              </p>
              <h3 className="text-2xl font-semibold text-gray-900 mb-0.5">
                {approvedCount}
              </h3>
              <div className="h-0.5 w-8 bg-gradient-to-r from-emerald-200 to-emerald-300 rounded-full mt-1"></div>
            </div>
          </div>
        </Link>

        {/* Rejected Leave */}
        <Link
          href={`${isAdmin ? "/dashboard/leaves-admin" : isHod ? "/dashboard/leaves-hod" : "/dashboard/leaves"}?status=Rejected`}
          className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-50/30 via-rose-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-gradient-to-br from-rose-200 to-rose-300 p-2.5 rounded-lg">
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <AlertCircle className="w-3.5 h-3.5 text-rose-300 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <p className="text-xs font-normal text-gray-500 mb-1 uppercase tracking-wide">
                Rejected
              </p>
              <h3 className="text-2xl font-semibold text-gray-900 mb-0.5">
                {rejectedCount}
              </h3>
              <div className="h-0.5 w-8 bg-gradient-to-r from-rose-200 to-rose-300 rounded-full mt-1"></div>
            </div>
          </div>
        </Link>
      </div>

      {/* Pending Approvals Section - Only for Admin and HOD */}
      {isAdminOrHod && pendingApprovals.length > 0 && (
        <Link
          href="/dashboard/approvals"
          className="group relative overflow-hidden block bg-gradient-to-r from-amber-50/40 via-yellow-50/30 to-amber-50/20 rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-200/10 to-yellow-200/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-amber-200 to-amber-300 p-2.5 rounded-lg group-hover:scale-105 transition-transform duration-300">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-gray-900 mb-0.5">
                  Pending Leave Approvals
                </h2>
                <p className="text-xs text-gray-600">
                  {pendingApprovals.length} leave request{pendingApprovals.length > 1 ? 's' : ''} awaiting your {isAdmin ? 'admin' : 'HOD'} approval
                </p>
              </div>
            </div>
            <div className="text-amber-400 text-base font-medium group-hover:translate-x-1 transition-transform duration-300">
              →
            </div>
          </div>
        </Link>
      )}

      {/* Quick Actions - Only for Employees */}
      {!isAdminOrHod && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/dashboard/apply-leave"
            className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-3 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-0.5">
                  Apply for Leave
                </h3>
                <p className="text-xs text-gray-600">
                  Submit a new leave request
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-200 to-blue-300 p-2.5 rounded-lg group-hover:scale-105 transition-transform duration-300 ml-2">
                <Plus className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/calendar"
            className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-3 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-0.5">
                  View Calendar
                </h3>
                <p className="text-xs text-gray-600">
                  Check leave calendar
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-200 to-emerald-300 p-2.5 rounded-lg group-hover:scale-105 transition-transform duration-300 ml-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/leaves"
            className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-3 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-0.5">
                  My Leaves
                </h3>
                <p className="text-xs text-gray-600">
                  View all my leaves
                </p>
              </div>
              <div className="bg-gradient-to-br from-indigo-200 to-indigo-300 p-2.5 rounded-lg group-hover:scale-105 transition-transform duration-300 ml-2">
                <FileCheck className="w-4 h-4 text-indigo-600" />
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
            className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-3 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-0.5">
                  Approvals
                </h3>
                <p className="text-xs text-gray-600">
                  Review and approve leave requests
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-200 to-blue-300 p-2.5 rounded-lg group-hover:scale-105 transition-transform duration-300 ml-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </Link>

          {isAdmin && (
            <Link
              href="/dashboard/employees"
              className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative p-3 flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 mb-0.5">
                    Employees
                  </h3>
                  <p className="text-xs text-gray-600">
                    Manage employees
                  </p>
                </div>
                <div className="bg-gradient-to-br from-emerald-200 to-emerald-300 p-2.5 rounded-lg group-hover:scale-105 transition-transform duration-300 ml-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </Link>
          )}

          <Link
            href={isAdmin ? "/dashboard/leaves-admin" : "/dashboard/leaves-hod"}
            className="group relative overflow-hidden bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-3 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-0.5">
                  All Leaves
                </h3>
                <p className="text-xs text-gray-600">
                  View all leave applications
                </p>
              </div>
              <div className="bg-gradient-to-br from-indigo-200 to-indigo-300 p-2.5 rounded-lg group-hover:scale-105 transition-transform duration-300 ml-2">
                <FileCheck className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Recent Leave Applications */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50/50 to-white flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-900">
            Recent Leave Applications
          </h2>
          <Link
            href={isAdminOrHod ? (isAdmin ? "/dashboard/leaves-admin" : "/dashboard/leaves-hod") : "/dashboard/leaves"}
            className="text-xs text-blue-400 hover:text-blue-500 font-medium flex items-center gap-1 transition-all group"
          >
            View All
            <span className="text-xs group-hover:translate-x-1 transition-transform duration-200">→</span>
          </Link>
        </div>
        <div className="p-4">
          {recentLeaves.length > 0 ? (
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/40">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Leave Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Application Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Days</th>
                    {/* Hide HOD Status for Admin */}
                    {!isAdmin && <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">HOD Status</th>}
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Admin Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeaves.map((leave: any, index: number) => (
                    <tr key={leave.id || leave._id || index} className="hover:bg-gray-50/50 transition-colors duration-150">
                      <td className="px-3 py-2 font-normal text-gray-900 text-xs">{leave.LeaveType || leave.leave_type || 'N/A'}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        <DateFormatter date={leave.createdAt || leave.created_at} />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 text-xs">{leave.NumOfDay || leave.number_of_days || 'N/A'}</td>
                      {/* Hide HOD Status for Admin, or show N/A for HOD-applied leaves */}
                      {!isAdmin && (() => {
                        const isHodAppliedLeave = (leave.EmployeeRole || leave.employee_role || '').toLowerCase() === 'hod' && 
                                                  (leave.HodStatus || leave.hod_status || 'Pending') === 'Pending' && 
                                                  !leave.approved_by_hod;
                        
                        if (isHodAppliedLeave) {
                          return (
                            <td className="px-3 py-2 text-gray-500 text-xs">N/A</td>
                          );
                        }
                        
                        return (
                          <td className="px-3 py-2">
                            <span
                              className={classNames('badge', {
                                'badge-approved': (leave.HodStatus || leave.hod_status) === 'Approved',
                                'badge-pending': (leave.HodStatus || leave.hod_status) === 'Pending',
                                'badge-rejected': (leave.HodStatus || leave.hod_status) === 'Rejected',
                              })}
                            >
                              {leave.HodStatus || leave.hod_status || 'Pending'}
                            </span>
                          </td>
                        );
                      })()}
                      <td className="px-3 py-2">
                        <span
                          className={classNames('badge', {
                            'badge-approved': (leave.AdminStatus || leave.admin_status) === 'Approved',
                            'badge-pending': (leave.AdminStatus || leave.admin_status) === 'Pending',
                            'badge-rejected': (leave.AdminStatus || leave.admin_status) === 'Rejected',
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
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                <FileCheck className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 mb-3 text-xs font-normal">
                No leave applications found
              </p>
              {!isAdminOrHod && (
                <Link
                  href="/dashboard/apply-leave"
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-300 to-blue-400 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:from-blue-400 hover:to-blue-500 transition-all duration-200 shadow-sm hover:shadow"
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import { FileSpreadsheet, Download, Filter, Search } from 'lucide-react';
import DateFormatter, { formatDate } from '@/utils/DateFormatter';
import ExportDataJSON from '@/utils/ExportFromJSON';
import classNames from 'classnames';

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  // Filters
  const [filters, setFilters] = useState({
    employeeId: '',
    status: 'All',
    startDate: '',
    endDate: '',
    leaveType: 'All',
  });

  useEffect(() => {
    fetchUserRole();
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchEmployees();
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole) {
      fetchReports();
    }
  }, [filters, userRole]);

  const fetchUserRole = async () => {
    try {
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get('/Auth/Me'),
        api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } }))
      ]);
      if (userResponse.data?.user?.role) {
        setUserRole(userResponse.data.user.role.toLowerCase());
      }
      if (permissionsResponse.data?.data) {
        setUserPermissions(permissionsResponse.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch user role:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      // Use same endpoint for both Admin and HOD - same logic as Admin
      const response = await api.get('/User/EmployeeList');
      const employeesData = response.data?.data || response.data?.Data || response.data || [];
      setEmployees(employeesData);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/LeaveType/LeaveTypeList');
      const leaveTypesData = response.data?.data || response.data?.Data || response.data || [];
      setLeaveTypes(leaveTypesData);
    } catch (err) {
      console.error('Failed to fetch leave types:', err);
      setLeaveTypes([]);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.employeeId && filters.employeeId !== 'All' && filters.employeeId !== '') {
        params.append('employeeId', filters.employeeId);
      }
      if (filters.status && filters.status !== 'All') {
        params.append('status', filters.status);
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.leaveType && filters.leaveType !== 'All') {
        params.append('leaveType', filters.leaveType);
      }

      const queryString = params.toString();
      const url = `/Leave/Reports${queryString ? '?' + queryString : ''}`;
      
      const response = await api.get(url);
      const reportsData = response.data?.Data || response.data?.data || [];
      const total = response.data?.Total?.[0]?.count || reportsData.length;
      
      setReports(reportsData);
      setTotalCount(total);
    } catch (err: any) {
      console.error('Failed to fetch reports:', err);
      if (err.response?.status === 401) {
        router.push('/login');
      } else if (err.response?.status === 403) {
        alert('You do not have permission to view reports');
        router.push('/dashboard');
      } else {
        setReports([]);
        setTotalCount(0);
      }
    } finally {
      setLoading(false);
    }
  };


  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      employeeId: '',
      status: 'All',
      startDate: '',
      endDate: '',
      leaveType: 'All',
    });
  };

  const handleExport = () => {
    if (reports.length === 0) {
      alert('No data to export');
      return;
    }

    const exportData = reports.map((report: any) => ({
      'Employee Name': report.full_name || `${report.Employee?.[0]?.FirstName || ''} ${report.Employee?.[0]?.LastName || ''}`.trim() || report.email,
      'Email': report.email || report.Employee?.[0]?.Email || '',
      'Leave Type': report.LeaveType || report.leave_type || '',
      'Start Date': formatDate(report.start_date || report.startDate || report.StartDate),
      'End Date': formatDate(report.end_date || report.endDate || report.EndDate),
      'Number of Days': report.NumOfDay || report.number_of_days || 0,
      'Status': report.status || 'Pending',
      'HOD Status': report.HodStatus || report.hod_status || 'Pending',
      'Admin Status': report.AdminStatus || report.admin_status || 'Pending',
      'HOD Approver': report.HodApproverName || report.hod_approver_name || 'N/A',
      'Admin Approver': report.AdminApproverName || report.admin_approver_name || 'N/A',
      'Reason': report.LeaveDetails || report.reason || '',
      'Created At': formatDate(report.createdAt || report.created_at),
    }));

    ExportDataJSON(exportData, 'Leave_Reports', 'xls');
  };

  // Check permission - reports.view must be explicitly checked (no admin bypass)
  const hasReportsViewPermission = userPermissions.includes('reports.view');

  // Don't show error while loading permissions
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasReportsViewPermission) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <p className="text-red-600 text-lg">You do not have permission to view reports.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Reports', path: '/dashboard/reports', active: true },
        ]}
        title="Leave Reports"
      />

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </h2>
          <button
            onClick={resetFilters}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Employee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee
            </label>
            <select
              value={filters.employeeId}
              onChange={(e) => handleFilterChange('employeeId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Employees</option>
              {employees.map((emp: any) => {
                const userId = emp.user_id || emp.id || emp._id;
                const fullName = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;
                return (
                  <option key={userId} value={userId}>
                    {fullName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Leave Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Leave Type
            </label>
            <select
              value={filters.leaveType}
              onChange={(e) => handleFilterChange('leaveType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Types</option>
              {leaveTypes.map((lt: any) => (
                <option key={lt.id || lt.leave_type_id} value={lt.name}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Reports Table Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
            <p className="text-sm text-gray-600 mt-1">
              Total: {totalCount} {totalCount === 1 ? 'record' : 'records'}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={reports.length === 0}
            className={classNames(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              reports.length === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            )}
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No reports found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leave Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    HOD Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report: any, index: number) => {
                  const fullName = report.full_name || `${report.Employee?.[0]?.FirstName || ''} ${report.Employee?.[0]?.LastName || ''}`.trim() || report.email;
                  const status = report.status || 'Pending';
                  const hodStatus = report.HodStatus || report.hod_status || 'Pending';
                  const adminStatus = report.AdminStatus || report.admin_status || 'Pending';
                  const employeeRole = report.employee_role || report.role;

                  return (
                    <tr key={report.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{fullName}</div>
                        <div className="text-sm text-gray-500">{report.email || report.Employee?.[0]?.Email || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.LeaveType || report.leave_type || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(report.start_date || report.startDate || report.StartDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(report.end_date || report.endDate || report.EndDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.NumOfDay || report.number_of_days || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={classNames(
                            'px-2 py-1 text-xs font-semibold rounded-full',
                            status === 'Approved'
                              ? 'bg-green-100 text-green-800'
                              : status === 'Rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          )}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {employeeRole?.toLowerCase() === 'hod' && report.approved_by_hod === null ? (
                          <span className="text-sm text-gray-500">N/A</span>
                        ) : (
                          <span
                            className={classNames(
                              'px-2 py-1 text-xs font-semibold rounded-full',
                              hodStatus === 'Approved'
                                ? 'bg-green-100 text-green-800'
                                : hodStatus === 'Rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            )}
                          >
                            {hodStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={classNames(
                            'px-2 py-1 text-xs font-semibold rounded-full',
                            adminStatus === 'Approved'
                              ? 'bg-green-100 text-green-800'
                              : adminStatus === 'Rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          )}
                        >
                          {adminStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={report.LeaveDetails || report.reason || ''}>
                        {report.LeaveDetails || report.reason || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

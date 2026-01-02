'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Download, Filter, Search } from 'lucide-react';
import ExportDataJSON from '@/utils/ExportFromJSON';

interface LeaveReport {
  id: number;
  employee_name: string;
  employee_email: string;
  leave_type: string;
  leave_type_code?: string;
  applied_date: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  status: string;
  hod_status?: string;
  admin_status?: string;
  approved_by?: string;
  hod_approver_name?: string;
  admin_approver_name?: string;
  reason?: string;
  team?: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<LeaveReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>([]);

  // Filters
  const [filters, setFilters] = useState({
    employee_id: 'all',
    status: 'all',
    from_date: '',
    to_date: '',
    leave_type: 'all',
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchEmployees();
      fetchLeaveTypes();
      fetchReports();
    }
  }, [userRole, filters]);

  const checkPermissions = async () => {
    try {
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get('/Auth/Me').catch(() => ({ data: { user: { role: 'employee' } } })),
        api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } }))
      ]);
      
      const role = userResponse.data?.user?.role?.toLowerCase() || 'employee';
      const userPermissions = permissionsResponse.data?.data || [];
      
      // Admin always has access, HOD needs reports.view permission
      if (role === 'admin') {
        setUserRole(role);
        setPermissions(userPermissions);
      } else if (role === 'hod' || role === 'HOD') {
        if (userPermissions.includes('reports.view')) {
          setUserRole(role);
          setPermissions(userPermissions);
        } else {
          router.push('/dashboard');
          return;
        }
      } else {
        // Employee has no access
        router.push('/dashboard');
        return;
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
      router.push('/dashboard');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/User/EmployeeList');
      setEmployees(response.data?.Data || response.data?.data || []);
    } catch (err: any) {
      console.error('Failed to fetch employees:', err);
      if (err.response?.status === 403) {
        // Permission denied - don't redirect, just log
        console.warn('No permission to fetch employees list');
      }
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/LeaveType/LeaveTypeList');
      setLeaveTypes(response.data?.Data || response.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch leave types:', err);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.employee_id && filters.employee_id !== 'all') {
        params.append('employee_id', filters.employee_id);
      }
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.from_date) {
        params.append('from_date', filters.from_date);
      }
      if (filters.to_date) {
        params.append('to_date', filters.to_date);
      }
      if (filters.leave_type && filters.leave_type !== 'all') {
        params.append('leave_type', filters.leave_type);
      }

      const response = await api.get(`/Leave/Reports?${params.toString()}`);
      const reportsData = response.data?.data || [];
      
      // Debug: Log first report to verify data structure
      if (reportsData.length > 0) {
        console.log('Sample report data:', reportsData[0]);
        console.log('Applied date:', reportsData[0].applied_date);
        console.log('Start date:', reportsData[0].start_date);
        console.log('End date:', reportsData[0].end_date);
      }
      
      setReports(reportsData);
    } catch (err: any) {
      console.error('Failed to fetch reports:', err);
      if (err.response?.status === 401) {
        router.push('/login');
      } else if (err.response?.status === 403) {
        alert('You do not have permission to view reports');
        router.push('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const exportToExcel = () => {
    if (reports.length === 0) {
      alert('No data to export');
      return;
    }

    // Prepare data for Excel export
    const excelData = reports.map(report => ({
      'Leave Type': report.leave_type || '',
      'Leave Code': report.leave_type_code || '',
      'Applied Date': report.applied_date ? formatDateDDMMYYYY(report.applied_date) : 'N/A',
      'From Date': report.start_date ? formatDateDDMMYYYY(report.start_date) : 'N/A',
      'To Date': report.end_date ? formatDateDDMMYYYY(report.end_date) : 'N/A',
      'Status': report.status || '',
      'Approved By': report.approved_by || '',
      'Reason': report.reason || '',
      'Employee Name': report.employee_name || '',
      'Number of Days': report.number_of_days || 0,
      'Team': report.team === 'US' ? 'US' : (report.team === 'IN' || report.team === 'India' ? 'IN' : report.team || 'N/A'),
    }));

    // Generate filename with current date
    const filename = `Leave_Reports_${new Date().toISOString().split('T')[0]}`;

    // Export using existing utility
    ExportDataJSON(excelData, filename, 'xls');
  };

  // Format date as dd-mm-yyyy
  const formatDateDDMMYYYY = (date: string | Date | null | undefined): string => {
    if (!date) return 'N/A';
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Date formatting error:', error, date);
      return 'N/A';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'approved') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Approved</span>;
    } else if (statusLower === 'rejected') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rejected</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">View and export leave reports</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Employee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select
              value={filters.employee_id}
              onChange={(e) => handleFilterChange('employee_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.user_id || emp.id} value={emp.user_id || emp.id}>
                  {emp.full_name || emp.email}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => handleFilterChange('from_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => handleFilterChange('to_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Leave Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
            <select
              value={filters.leave_type}
              onChange={(e) => handleFilterChange('leave_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.name}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Export Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={exportToExcel}
            disabled={reports.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-gray-600">No reports found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leave Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applied Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    HOD Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Approved By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.employee_name || report.employee_email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.leave_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.applied_date ? formatDateDDMMYYYY(report.applied_date) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.start_date ? formatDateDDMMYYYY(report.start_date) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.end_date ? formatDateDDMMYYYY(report.end_date) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.number_of_days}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(report.hod_status || 'Pending')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(report.admin_status || 'Pending')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.approved_by || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={report.reason || ''}>
                      {report.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


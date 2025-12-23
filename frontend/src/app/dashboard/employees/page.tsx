'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import { Trash2 } from 'lucide-react';

export default function EmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchUserRole();
    fetchEmployees();
  }, []);

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
    }
  };

  // Refetch when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchEmployees();
      }
    };

    const handleFocus = () => {
      fetchEmployees();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Refetch when searchParams change (e.g., ?refresh=true)
  useEffect(() => {
    if (searchParams?.get('refresh') === 'true') {
      fetchEmployees();
      // Clean up the URL
      router.replace('/dashboard/employees', { scroll: false });
    }
  }, [searchParams, router]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      // Check if token exists
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        console.error('No auth token found');
        alert('Please login again');
        window.location.href = '/login';
        return;
      }
      
      const response = await api.get('/User/EmployeeList');
      const employees = response.data?.data || response.data?.Data || response.data || [];
      setEmployees(employees);
    } catch (err: any) {
      console.error('Failed to fetch employees:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        response: err.response?.data,
        status: err.response?.status,
        timeout: err.code === 'ECONNABORTED'
      });
      
      if (err.code === 'ECONNABORTED') {
        alert('Request timed out. The server might be slow. Please try again.');
      } else if (err.response?.status === 401) {
        // 401 = Authentication failed - redirect to login
        alert('Session expired. Please login again.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
      } else if (err.response?.status === 403) {
        // 403 = Permission denied - show error but don't redirect
        const errorMsg = err.response?.data?.message || 'You do not have permission to view employees. Please contact your administrator.';
        alert(`Access denied: ${errorMsg}`);
      } else {
        // Show error to user
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unknown error';
        alert(`Failed to load employees: ${errorMsg}`);
      }
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (userId: number, employeeName: string) => {
    if (!confirm(`Are you sure you want to delete employee "${employeeName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/User/DeleteEmployee/${userId}`);
      alert('Employee deleted successfully!');
      fetchEmployees();
    } catch (err: any) {
      console.error('Failed to delete employee:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to delete employee';
      alert(errorMsg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Employees', path: '/dashboard/employees', active: true },
        ]}
        title="Employee List"
      />

      <div className="space-y-6 mt-6">

      {/* Employees list */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Employees ({employees.length})
          </h2>
          {(userRole === 'admin' || userPermissions.includes('employee.create')) && (
            <Link
              href="/dashboard/employees/create"
              className="bg-[#2563EB] text-white px-4 py-2.5 rounded-lg font-medium hover:bg-[#1D4ED8] transition-all text-sm shadow-sm hover:shadow-md"
            >
              + Add Employee
            </Link>
          )}
        </div>
        <div className="p-6">
          {employees.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Location</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Assigned HOD</th>
                    <th>Assigned Admin</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.employee_id || employee.id}>
                      <td className="font-medium text-gray-900">{employee.full_name}</td>
                      <td className="text-gray-700">{employee.email}</td>
                      <td className="text-gray-700">{employee.location || '-'}</td>
                      <td className="text-gray-700">{employee.team || employee.department || '-'}</td>
                      <td>
                        <span className="badge bg-blue-100 text-blue-800">
                          {employee.role || 'employee'}
                        </span>
                      </td>
                      <td className="text-gray-700">
                        {employee.hod_name ? (
                          <div>
                            <div className="font-medium text-gray-900">{employee.hod_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{employee.hod_email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="text-gray-700">
                        {employee.admin_name ? (
                          <div>
                            <div className="font-medium text-gray-900">{employee.admin_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{employee.admin_email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/employees/edit/${employee.user_id || employee.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                          >
                            Edit
                          </Link>
                          {/* Delete button - Admin only */}
                          {(userRole === 'admin' || userPermissions.includes('employee.delete')) && (
                            <button
                              onClick={() => handleDeleteEmployee(employee.user_id || employee.id, employee.full_name || employee.email)}
                              className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50 transition-colors"
                              title="Delete Employee"
                              aria-label="Delete employee"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">No employees found</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}







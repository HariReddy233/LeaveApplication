'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';

export default function EmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

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
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        alert('Session expired. Please login again.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Employees', path: '/dashboard/employees', active: true },
        ]}
        title="Employee List"
      />

      <div className="space-y-6">

      {/* Employees list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Employees ({employees.length})
          </h2>
          <Link
            href="/dashboard/employees/create"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            + Add Employee
          </Link>
        </div>
        <div className="p-6">
          {employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-600 text-sm font-medium border-b">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Location</th>
                    <th className="pb-3">Department</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Assigned HOD</th>
                    <th className="pb-3">Assigned Admin</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.employee_id || employee.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 text-gray-900">{employee.full_name}</td>
                      <td className="py-3 text-gray-700">{employee.email}</td>
                      <td className="py-3 text-gray-700">{employee.location || '-'}</td>
                      <td className="py-3 text-gray-700">{employee.team || employee.department || '-'}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {employee.role || 'employee'}
                        </span>
                      </td>
                      <td className="py-3 text-gray-700">
                        {employee.hod_name ? (
                          <div>
                            <div className="font-medium">{employee.hod_name}</div>
                            <div className="text-xs text-gray-500">{employee.hod_email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-gray-700">
                        {employee.admin_name ? (
                          <div>
                            <div className="font-medium">{employee.admin_name}</div>
                            <div className="text-xs text-gray-500">{employee.admin_email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/dashboard/employees/edit/${employee.user_id || employee.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No employees found</div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}







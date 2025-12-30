'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import { Trash2, Building } from 'lucide-react';

export default function DepartmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchUserRole();
    fetchDepartments();
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
        fetchDepartments();
      }
    };

    const handleFocus = () => {
      fetchDepartments();
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
      fetchDepartments();
      // Clean up the URL
      router.replace('/dashboard/departments', { scroll: false });
    }
  }, [searchParams, router]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/Department/DepartmentList');
      setDepartments(response.data?.Data || response.data?.data || response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch departments:', err);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the department "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/Department/DepartmentDelete/${id}`);
      alert('Department deleted successfully!');
      fetchDepartments();
    } catch (err: any) {
      console.error('Failed to delete department:', err);
      
      // Handle different error types correctly
      if (err.response?.status === 401) {
        // 401 = Authentication failed - redirect to login
        alert('Session expired. Please login again.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
      } else if (err.response?.status === 403) {
        // 403 = Permission denied - show error but don't redirect
        const errorMsg = err.response?.data?.message || 'You do not have permission to delete departments. Please contact your administrator.';
        alert(`Access denied: ${errorMsg}`);
      } else {
        // Other errors (network, validation, etc.)
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to delete department';
        alert(errorMsg);
      }
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
          { label: 'Departments', path: '/dashboard/departments', active: true },
        ]}
        title="Department List"
      />

      <div className="card overflow-hidden mt-6">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Departments ({departments.length})
          </h2>
          {(userRole === 'admin' || userPermissions.includes('department.create')) && (
            <Link
              href="/dashboard/departments/create"
              className="bg-[#2563EB] text-white px-4 py-2.5 rounded-lg font-medium hover:bg-[#1D4ED8] transition-all text-sm shadow-sm hover:shadow-md"
            >
              + Add Department
            </Link>
          )}
        </div>
        <div className="p-6">
          {departments.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Employees</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept.id}>
                      <td className="font-medium text-gray-900">{dept.name}</td>
                      <td className="text-gray-700">{dept.description || '-'}</td>
                      <td className="text-gray-700">{dept.employee_count || 0}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              const newName = prompt('Enter new department name:', dept.name);
                              if (newName && newName.trim()) {
                                // Note: Department editing would require updating employee team assignments
                                alert('Department editing requires updating employee team assignments. This feature can be added if needed.');
                              }
                            }}
                            className="text-[#2563EB] hover:text-[#1D4ED8] text-sm font-medium transition-colors"
                          >
                            Edit
                          </button>
                          {/* Delete button - Permission-based */}
                          {(userRole === 'admin' || userPermissions.includes('department.delete')) && (
                            <button
                              onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                              className="text-[#DC2626] hover:text-[#B91C1C] p-1.5 rounded hover:bg-red-50 transition-colors"
                              title="Delete Department"
                              aria-label="Delete department"
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
              <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">No departments found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


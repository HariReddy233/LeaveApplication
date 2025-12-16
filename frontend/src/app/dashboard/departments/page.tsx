'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';

export default function DepartmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, []);

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
          { label: 'Departments', path: '/dashboard/departments', active: true },
        ]}
        title="Department List"
      />

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Departments ({departments.length})
          </h2>
          <Link
            href="/dashboard/departments/create"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            + Add Department
          </Link>
        </div>
        <div className="p-6">
          {departments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-600 text-sm font-medium border-b">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Employees</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 text-gray-900 font-medium">{dept.name}</td>
                      <td className="py-3 text-gray-700">{dept.description || '-'}</td>
                      <td className="py-3 text-gray-700">{dept.employee_count || 0}</td>
                      <td className="py-3">
                        <button
                          onClick={() => {
                            const newName = prompt('Enter new department name:', dept.name);
                            if (newName && newName.trim()) {
                              // Note: Department editing would require updating employee team assignments
                              alert('Department editing requires updating employee team assignments. This feature can be added if needed.');
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No departments found</div>
          )}
        </div>
      </div>
    </>
  );
}


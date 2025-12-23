'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import { Trash2, FileText } from 'lucide-react';

export default function LeaveTypesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchUserRole();
    fetchLeaveTypes();
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
        fetchLeaveTypes();
      }
    };

    const handleFocus = () => {
      fetchLeaveTypes();
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
      fetchLeaveTypes();
      // Clean up the URL
      router.replace('/dashboard/leave-types', { scroll: false });
    }
  }, [searchParams, router]);

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/LeaveType/LeaveTypeList');
      setLeaveTypes(response.data?.Data || response.data?.data || response.data || []);
    } catch (err: any) {
      setLeaveTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"?\n\nNote: This leave type cannot be deleted if it's being used in leave applications.`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/LeaveType/LeaveTypeDelete/${id}`);
      alert('Leave type deleted successfully!');
      fetchLeaveTypes(); // Refresh the list
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to delete leave type';
      alert(errorMessage);
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
          { label: 'Leave Types', path: '/dashboard/leave-types', active: true },
        ]}
        title="Leave Type List"
      />

      <div className="card overflow-hidden mt-6">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Leave Types ({leaveTypes.length})
          </h2>
          {(userRole === 'admin' || userPermissions.includes('leavetype.create')) && (
            <Link
              href="/dashboard/leave-types/create"
              className="bg-[#2563EB] text-white px-4 py-2.5 rounded-lg font-medium hover:bg-[#1D4ED8] transition-all text-sm shadow-sm hover:shadow-md"
            >
              + Add Leave Type
            </Link>
          )}
        </div>
        <div className="p-6">
          {leaveTypes.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Max Days</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.map((type) => (
                    <tr key={type.id}>
                      <td className="font-medium text-gray-900">{type.name}</td>
                      <td className="text-gray-700">{type.max_days || '-'}</td>
                      <td className="text-gray-700">{type.description || '-'}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          {(userRole === 'admin' || userPermissions.includes('leavetype.edit')) && (
                            <Link
                              href={`/dashboard/leave-types/edit/${type.id}`}
                              className="text-[#2563EB] hover:text-[#1D4ED8] text-sm font-medium transition-colors"
                            >
                              Edit
                            </Link>
                          )}
                          {(userRole === 'admin' || userPermissions.includes('leavetype.delete')) && (
                            <button
                              onClick={() => handleDelete(type.id, type.name)}
                              className="text-[#DC2626] hover:text-[#B91C1C] text-sm font-medium flex items-center gap-1 transition-colors"
                              title="Delete Leave Type"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
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
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">No leave types found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


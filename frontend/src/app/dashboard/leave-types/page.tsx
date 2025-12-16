'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import { Trash2 } from 'lucide-react';

export default function LeaveTypesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

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
    <>
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Leave Types', path: '/dashboard/leave-types', active: true },
        ]}
        title="Leave Type List"
      />

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Leave Types ({leaveTypes.length})
          </h2>
        </div>
        <div className="p-6">
          {leaveTypes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-600 text-sm font-medium border-b">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Max Days</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.map((type) => (
                    <tr key={type.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 text-gray-900 font-medium">{type.name}</td>
                      <td className="py-3 text-gray-700">{type.max_days || '-'}</td>
                      <td className="py-3 text-gray-700">{type.description || '-'}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/leave-types/edit/${type.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(type.id, type.name)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
                            title="Delete Leave Type"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No leave types found</div>
          )}
        </div>
      </div>
    </>
  );
}


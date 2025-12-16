'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';

export default function EditLeaveTypePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    max_days: '',
    carry_forward: false,
    description: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchLeaveType();
    }
  }, [id]);

  const fetchLeaveType = async () => {
    try {
      setFetching(true);
      const response = await api.get('/LeaveType/LeaveTypeList');
      const leaveTypes = response.data?.Data || response.data?.data || [];
      const leaveType = leaveTypes.find((lt: any) => lt.id === parseInt(id));
      
      if (leaveType) {
        setFormData({
          name: leaveType.name || '',
          code: leaveType.code || '',
          max_days: leaveType.max_days?.toString() || '',
          carry_forward: leaveType.carry_forward || false,
          description: leaveType.description || '',
          is_active: leaveType.is_active !== false,
        });
      } else {
        setError('Leave type not found');
      }
    } catch (err: any) {
      console.error('Failed to fetch leave type:', err);
      setError('Failed to load leave type details');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.patch(`/LeaveType/LeaveTypeUpdate/${id}`, {
        name: formData.name,
        code: formData.code || null,
        max_days: formData.max_days ? parseInt(formData.max_days) : null,
        carry_forward: formData.carry_forward,
        description: formData.description || null,
        is_active: formData.is_active,
      });
      
      alert('Leave type updated successfully!');
      router.push('/dashboard/leave-types?refresh=true');
    } catch (err: any) {
      console.error('Leave type update error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to update leave type');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
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
          { label: 'Leave Types', path: '/dashboard/leave-types' },
          { label: 'Edit Leave Type', path: `/dashboard/leave-types/edit/${id}`, active: true },
        ]}
        title="Edit Leave Type"
      />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Leave Type Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Type Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                  placeholder="e.g., Sick Leave, Vacation"
                />
              </div>

              {/* Code */}
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  Code
                </label>
                <input
                  id="code"
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                  placeholder="e.g., SL, VL"
                />
              </div>

              {/* Max Days */}
              <div>
                <label htmlFor="max_days" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Days
                </label>
                <input
                  id="max_days"
                  type="number"
                  value={formData.max_days}
                  onChange={(e) => setFormData({ ...formData, max_days: e.target.value })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                  placeholder="e.g., 12"
                />
              </div>

              {/* Carry Forward */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.carry_forward}
                      onChange={(e) => setFormData({ ...formData, carry_forward: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Can Carry Forward</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-none text-sm"
                placeholder="Enter leave type description..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {loading ? 'Updating...' : 'Update Leave Type'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/leave-types')}
                className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';

export default function CreateLeaveTypePage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    max_days: '',
    carry_forward: false,
    description: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const [permissionsResponse, userResponse] = await Promise.all([
          api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } })),
          api.get('/Auth/Me').catch(() => ({ data: { user: null } }))
        ]);
        
        if (permissionsResponse.data?.data) {
          setUserPermissions(permissionsResponse.data.data);
        }
        
        // Check if user has leavetype.create permission or is admin
        const userRole = userResponse.data?.user?.role?.toLowerCase();
        const hasPermission = permissionsResponse.data?.data?.includes('leavetype.create');
        
        if (!hasPermission && userRole !== 'admin') {
          router.push('/dashboard/leave-types');
          return;
        }
      } catch (err) {
        console.error('Failed to check permissions:', err);
      }
    };
    checkPermissions();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/LeaveType/LeaveTypeCreate', {
        name: formData.name,
        code: formData.code || null,
        max_days: formData.max_days ? parseInt(formData.max_days) : null,
        carry_forward: formData.carry_forward,
        description: formData.description || null,
        is_active: formData.is_active,
      });
      
      alert('Leave type created successfully!');
      router.push('/dashboard/leave-types?refresh=true');
    } catch (err: any) {
      console.error('Leave type creation error:', err);
      if (err.response?.status === 401) {
        // 401 = Authentication failed - redirect to login
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (err.response?.status === 403) {
        // 403 = Permission denied - show error but don't redirect
        setError(err.response?.data?.message || 'You do not have permission to create leave types. Please contact your administrator.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create leave type');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Leave Types', path: '/dashboard/leave-types' },
          { label: 'Add Leave Type', path: '/dashboard/leave-types/create', active: true },
        ]}
        title="Add Leave Type"
      />

      <div className="card mt-6">
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
                    <label htmlFor="code" className="form-label">
                      Code
                    </label>
                    <input
                      id="code"
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="form-input"
                      placeholder="e.g., SL, VL"
                    />
              </div>

              {/* Max Days */}
              <div>
                    <label htmlFor="max_days" className="form-label">
                      Max Days
                    </label>
                    <input
                      id="max_days"
                      type="number"
                      value={formData.max_days}
                      onChange={(e) => setFormData({ ...formData, max_days: e.target.value })}
                      min="0"
                      className="form-input"
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
                    <label htmlFor="description" className="form-label">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="form-input resize-none"
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
                {loading ? 'Creating...' : 'Create Leave Type'}
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
    </div>
  );
}


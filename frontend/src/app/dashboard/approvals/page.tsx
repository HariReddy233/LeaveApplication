'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CheckCircle, XCircle, Clock, AlertCircle, User, Trash2 } from 'lucide-react';
import DateFormatter from '@/utils/DateFormatter';
import classNames from 'classnames';
import { useSSE } from '@/hooks/useSSE';

export default function ApprovalsPage() {
  const router = useRouter();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [userRole, setUserRole] = useState<string>('');
  const [selectedLeaves, setSelectedLeaves] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [permissions, setPermissions] = useState<string[]>([]);

  const fetchUserRole = async () => {
    try {
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get('/Auth/Me'),
        api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } }))
      ]);
      
      if (userResponse.data?.user?.role) {
        const role = userResponse.data.user.role.toLowerCase();
        setUserRole(role);
        
        const userPermissions = permissionsResponse.data?.data || [];
        setPermissions(userPermissions);
        
        // Check if user has leave.approve or leave.reject permission
        const hasApprove = userPermissions.includes('leave.approve');
        const hasReject = userPermissions.includes('leave.reject');
        
        // For HOD and Employee, must have permission (no admin bypass)
        if (role === 'hod' || role === 'HOD' || role === 'employee' || role === 'Employee') {
          if (!hasApprove && !hasReject) {
            router.push('/dashboard');
            return;
          }
        } else if (role === 'admin') {
          // Admin can access, but still check permissions for consistency
          if (!hasApprove && !hasReject) {
            router.push('/dashboard');
            return;
          }
        } else {
          // Other roles cannot access approvals
          router.push('/dashboard');
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch user role:', err);
      router.push('/dashboard');
    }
  };

  const fetchLeaves = async () => {
    if (!userRole) return; // Don't fetch if userRole is not set yet
    try {
      setLoading(true);
      setError('');
      
      // Use the correct endpoint based on user role
      let response;
      if (userRole === 'admin') {
        response = await api.get('/Leave/LeaveAdminList/1/100/0');
      } else if (userRole === 'hod') {
        response = await api.get('/Leave/LeaveListHod/1/100/0');
      } else {
        setError('You do not have permission to view approvals');
        setLoading(false);
        return;
      }
      
      const allLeaves = response.data?.Data || response.data?.data || [];
      
      // Filter by status - Role-specific: Each role sees their own approval status
      if (filter === 'pending') {
        setLeaves(allLeaves.filter((l: any) => {
          const hodStatus = l.hod_status || l.HodStatus || 'Pending';
          const adminStatus = l.admin_status || l.AdminStatus || 'Pending';
          // Show pending based on current user's role
          if (userRole === 'admin') {
            return adminStatus === 'Pending';
          } else if (userRole === 'hod') {
            return hodStatus === 'Pending';
          }
          return false;
        }));
      } else if (filter === 'approved') {
        setLeaves(allLeaves.filter((l: any) => {
          const hodStatus = l.hod_status || l.HodStatus || 'Pending';
          const adminStatus = l.admin_status || l.AdminStatus || 'Pending';
          // Show approved based on current user's role
          if (userRole === 'admin') {
            return adminStatus === 'Approved';
          } else if (userRole === 'hod') {
            return hodStatus === 'Approved';
          }
          return false;
        }));
      } else if (filter === 'rejected') {
        setLeaves(allLeaves.filter((l: any) => {
          const hodStatus = l.hod_status || l.HodStatus || 'Pending';
          const adminStatus = l.admin_status || l.AdminStatus || 'Pending';
          // Show rejected based on current user's role
          if (userRole === 'admin') {
            return adminStatus === 'Rejected';
          } else if (userRole === 'hod') {
            return hodStatus === 'Rejected';
          }
          return false;
        }));
      } else {
        setLeaves(allLeaves);
      }
    } catch (err: any) {
      console.error('Failed to fetch leaves:', err);
      if (err.response?.status === 401) {
        // 401 = Authentication failed - redirect to login
        router.push('/login');
      } else if (err.response?.status === 403) {
        // 403 = Permission denied - show error but don't redirect
        setError(err.response?.data?.message || 'You do not have permission to view approvals');
      } else {
        setError('Failed to load leave applications. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Real-time updates via SSE
  useSSE({
    onNewLeave: (event) => {
      // Refresh leaves list when new leave is created
      if (userRole) {
        fetchLeaves();
      }
    },
    onLeaveStatusUpdate: (event) => {
      // Refresh leaves list when leave status is updated (immediately, no delay)
      if (userRole) {
        fetchLeaves();
      }
    },
    onLeaveDeleted: (event) => {
      // Refresh leaves list when leave is deleted
      if (userRole) {
        fetchLeaves();
      }
    },
    enabled: true
  });

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchLeaves();
    }
    // Clear selections when filter changes
    setSelectedLeaves(new Set());
  }, [filter, userRole]);

  const handleApproval = async (id: number, status: 'approved' | 'rejected', comment: string = '') => {
    try {
      // Use the correct approval endpoint based on user role
      if (userRole === 'hod') {
        await api.patch(`/Leave/LeaveApproveHod/${id}`, { 
          status: status === 'approved' ? 'Approved' : 'Rejected',
          comment: comment 
        });
      } else if (userRole === 'admin') {
        await api.patch(`/Leave/LeaveApprove/${id}`, { 
          status: status === 'approved' ? 'Approved' : 'Rejected',
          comment: comment 
        });
      } else {
        alert('You do not have permission to approve leaves');
        return;
      }
      
      // Navigate to the corresponding tab based on action - set filter after successful API call
      setFilter(status);
      
      // Immediately refresh the list (SSE will also trigger a refresh, but this ensures it happens)
      await fetchLeaves();
    } catch (err: any) {
      console.error('Failed to update leave:', err);
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to update leave application');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this leave application? This action cannot be undone.')) {
      return;
    }
    
    try {
      await api.delete(`/Leave/LeaveDelete/${id}`);
      // Refresh the list
      await fetchLeaves();
    } catch (err: any) {
      console.error('Failed to delete leave:', err);
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to delete leave application');
    }
  };

  const handleSelectLeave = (id: number) => {
    const newSelected = new Set(selectedLeaves);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeaves(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLeaves.size === leaves.length) {
      setSelectedLeaves(new Set());
    } else {
      setSelectedLeaves(new Set(leaves.map(l => l.id || l._id)));
    }
  };

  const handleBulkApproval = async (status: 'approved' | 'rejected') => {
    if (selectedLeaves.size === 0) {
      alert('Please select at least one leave application');
      return;
    }

    if (!confirm(`Are you sure you want to ${status} ${selectedLeaves.size} leave application(s)?`)) {
      return;
    }

    try {
      setBulkLoading(true);
      const leaveIds = Array.from(selectedLeaves);
      
      // Use the correct bulk approval endpoint based on user role
      if (userRole === 'hod') {
        await api.post('/Leave/BulkApproveHod', {
          leave_ids: leaveIds,
          status: status === 'approved' ? 'Approved' : 'Rejected',
          comment: ''
        });
      } else if (userRole === 'admin') {
        await api.post('/Leave/BulkApprove', {
          leave_ids: leaveIds,
          status: status === 'approved' ? 'Approved' : 'Rejected',
          comment: ''
        });
      } else {
        alert('You do not have permission to approve leaves');
        return;
      }

      setSelectedLeaves(new Set());
      await fetchLeaves();
      alert(`Successfully ${status} ${leaveIds.length} leave application(s)`);
    } catch (err: any) {
      console.error('Failed to bulk update leaves:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to update leave applications';
      alert(errorMsg);
    } finally {
      setBulkLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <div className="text-gray-600 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      {/* Compact Header */}
      <div className="card">
        <h1 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Leave Approvals
        </h1>
        <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Review and approve leave applications
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{error}</span>
        </div>
      )}

      {/* Bulk Actions - Only show if there are pending leaves and user can approve */}
      {filter === 'pending' && leaves.length > 0 && (userRole === 'hod' || userRole === 'admin') && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedLeaves.size === leaves.length && leaves.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedLeaves.size > 0 ? `${selectedLeaves.size} selected` : 'Select all'}
              </span>
            </div>
            {selectedLeaves.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkApproval('approved')}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve Selected ({selectedLeaves.size})
                </button>
                <button
                  onClick={() => handleBulkApproval('rejected')}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md font-semibold hover:bg-red-700 transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject Selected ({selectedLeaves.size})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter tabs - Modern Design */}
      <div className="card p-2">
        <button
          onClick={() => setFilter('pending')}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-all rounded-md ${
            filter === 'pending'
              ? 'bg-yellow-100 text-yellow-700 shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          Pending
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-all rounded-md ${
            filter === 'approved'
              ? 'bg-green-100 text-green-700 shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          <CheckCircle className="w-3.5 h-3.5 inline mr-1.5" />
          Approved
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-all rounded-md ${
            filter === 'rejected'
              ? 'bg-red-100 text-red-700 shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          <XCircle className="w-3.5 h-3.5 inline mr-1.5" />
          Rejected
        </button>
      </div>

      {/* Leave applications - Compact Cards */}
      <div className="space-y-3">
        {leaves.length === 0 && (
          <div className="card text-center py-12">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              No {filter} leave applications
            </p>
          </div>
        )}

        {leaves.map((leave) => {
          const employee = leave.Employee?.[0] || {};
          const employeeName = `${employee.FirstName || ''} ${employee.LastName || ''}`.trim() || leave.full_name || 'Unknown User';
          const employeeEmail = employee.Email || leave.email || 'No email';
          const hodStatus = (leave.hod_status || leave.HodStatus || 'Pending').toString().trim();
          const adminStatus = (leave.admin_status || leave.AdminStatus || 'Pending').toString().trim();
          const leaveType = leave.LeaveType || leave.leave_type || 'N/A';
          
          // Only show Approve/Reject buttons if status is Pending for the current user's role
          // Hide buttons if already Approved or Rejected
          const canApprove = 
            (userRole === 'hod' && hodStatus.toLowerCase() === 'pending') || 
            (userRole === 'admin' && adminStatus.toLowerCase() === 'pending');
          
          return (
            <div
              key={leave.id || leave._id}
              className={`card p-5 hover:shadow-md transition-all ${
                selectedLeaves.has(leave.id || leave._id) ? 'bg-blue-50 border-l-4 border-[#2563EB]' : ''
              }`}
            >
              {/* Header with Employee Info */}
              <div className="flex items-start justify-between mb-3">
                {/* Checkbox for bulk selection - Only show for pending leaves */}
                {canApprove && filter === 'pending' && (
                  <input
                    type="checkbox"
                    checked={selectedLeaves.has(leave.id || leave._id)}
                    onChange={() => handleSelectLeave(leave.id || leave._id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 mr-2"
                  />
                )}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {employeeName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {employeeName}
                    </h3>
                    <p className="text-xs text-gray-500 truncate" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {employeeEmail}
                    </p>
                  </div>
                </div>
                {canApprove ? (
                  <span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-700 flex-shrink-0">
                    Pending
                  </span>
                ) : (
                  <span className={classNames('px-2 py-1 rounded-md text-xs font-medium flex-shrink-0', {
                    'bg-green-100 text-green-700': (userRole === 'hod' && hodStatus.toLowerCase() === 'approved') || (userRole === 'admin' && adminStatus.toLowerCase() === 'approved'),
                    'bg-red-100 text-red-700': (userRole === 'hod' && hodStatus.toLowerCase() === 'rejected') || (userRole === 'admin' && adminStatus.toLowerCase() === 'rejected'),
                  })}>
                    {userRole === 'hod' ? hodStatus : adminStatus}
                  </span>
                )}
              </div>

              {/* Leave Details - Compact Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div>
                  <span className="text-gray-500 font-medium">Leave Type:</span>
                  <span className="ml-1.5 text-gray-900">{leaveType}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Days:</span>
                  <span className="ml-1.5 text-gray-900">{leave.NumOfDay || leave.number_of_days || 'N/A'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 font-medium">Dates:</span>
                  <span className="ml-1.5 text-gray-900">
                    <DateFormatter date={leave.start_date} /> - <DateFormatter date={leave.end_date} />
                  </span>
                </div>
                {leave.reason && (
                  <div className="col-span-2 mt-1 p-2 bg-gray-50 rounded border border-gray-200">
                    <span className="text-gray-500 font-medium">Reason:</span>
                    <p className="text-gray-700 mt-0.5 text-xs" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {leave.reason}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Badges - Show HOD and Admin with Names */}
              <div className="flex items-center gap-4 mb-3 pb-3 border-b border-gray-100">
                {/* Always show HOD Status with Name */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">HOD:</span>
                  <span className="text-xs font-medium text-gray-700">
                    {leave.HodApproverName || leave.hod_approver_name || 'N/A'}
                  </span>
                  <span className={classNames('px-2 py-0.5 rounded text-xs font-medium', {
                    'bg-green-100 text-green-700': hodStatus.toLowerCase() === 'approved',
                    'bg-yellow-100 text-yellow-700': hodStatus.toLowerCase() === 'pending',
                    'bg-red-100 text-red-700': hodStatus.toLowerCase() === 'rejected',
                  })}>
                    ({hodStatus})
                  </span>
                </div>
                {/* Always show Admin Status with Name */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Admin:</span>
                  <span className="text-xs font-medium text-gray-700">
                    {leave.AdminApproverName || leave.admin_approver_name || 'N/A'}
                  </span>
                  <span className={classNames('px-2 py-0.5 rounded text-xs font-medium', {
                    'bg-green-100 text-green-700': adminStatus.toLowerCase() === 'approved',
                    'bg-yellow-100 text-yellow-700': adminStatus.toLowerCase() === 'pending',
                    'bg-red-100 text-red-700': adminStatus.toLowerCase() === 'rejected',
                  })}>
                    ({adminStatus})
                  </span>
                </div>
              </div>

              {/* Approval Buttons - Only show if status is Pending, hide if already Approved/Rejected */}
              {canApprove ? (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await handleApproval(leave.id || leave._id, 'approved', '');
                    }}
                    className="flex-1 bg-green-600 text-white py-2 rounded-md font-semibold hover:bg-green-700 transition-all text-xs flex items-center justify-center gap-1.5"
                    style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await handleApproval(leave.id || leave._id, 'rejected', '');
                    }}
                    className="flex-1 bg-red-600 text-white py-2 rounded-md font-semibold hover:bg-red-700 transition-all text-xs flex items-center justify-center gap-1.5"
                    style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              ) : (
                // Show delete button for admin only, on approved/rejected leaves (status already shown in header and middle section)
                <div className="flex items-center justify-end gap-2">
                  {userRole === 'admin' && (adminStatus.toLowerCase() === 'approved' || adminStatus.toLowerCase() === 'rejected') && (
                    <button
                      onClick={() => handleDelete(leave.id || leave._id)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-md font-semibold hover:bg-red-700 transition-all text-xs flex items-center justify-center gap-1.5"
                      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                      title="Delete leave application"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              )}

              {/* Approval Comment */}
              {leave.approval_comment && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    <span className="font-medium text-gray-700">Comment:</span> {leave.approval_comment}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

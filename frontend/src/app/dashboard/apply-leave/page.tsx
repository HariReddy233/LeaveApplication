'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';

export default function ApplyLeavePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leaveId = searchParams.get('id');
  const isUpdate = !!leaveId;

  const [formData, setFormData] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    number_of_days: '',
    leave_details: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<any[]>([]);
  const [selectedLeaveBalance, setSelectedLeaveBalance] = useState<any>(null);
  const [balanceError, setBalanceError] = useState('');
  const [overlapError, setOverlapError] = useState('');
  const [blockedDates, setBlockedDates] = useState<string[]>([]);

  useEffect(() => {
    fetchLeaveTypes();
    if (!isUpdate) {
      fetchLeaveBalance();
      fetchBlockedDates();
    }
    if (isUpdate) {
      fetchLeaveDetails();
    }
  }, [isUpdate, leaveId]);

  // Check for overlapping dates when dates change
  useEffect(() => {
    if (formData.start_date && formData.end_date && !isUpdate) {
      checkOverlappingDates();
    } else {
      setOverlapError('');
    }
  }, [formData.start_date, formData.end_date, isUpdate]);

  const fetchLeaveTypes = async () => {
    try {
      // Try to fetch from API first
      try {
        const response = await api.get('/LeaveType/LeaveTypeList');
        const types = response.data?.data || response.data?.Data || response.data || [];
        if (Array.isArray(types) && types.length > 0) {
          setLeaveTypes(types.map((type: any) => ({
            value: type.name || type.leave_type || type.value,
            label: type.name || type.leave_type || type.label
          })));
          return;
        }
      } catch (apiErr) {
        console.warn('Failed to fetch leave types from API, using defaults');
      }
      
      // Fallback to hardcoded types
      setLeaveTypes([
        { value: 'Sick Leave', label: 'Sick Leave' },
        { value: 'Vacation', label: 'Vacation' },
        { value: 'Personal', label: 'Personal' },
        { value: 'Casual', label: 'Casual' },
      ]);
    } catch (err) {
      console.error('Failed to fetch leave types:', err);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await api.get('/Leave/LeaveBalance');
      const balance = response.data?.data || response.data || [];
      setLeaveBalance(balance);
      console.log('✅ Leave balance fetched:', balance);
    } catch (err: any) {
      console.error('Failed to fetch leave balance:', err);
      setLeaveBalance([]);
    }
  };

  const fetchLeaveDetails = async () => {
    try {
      const response = await api.get(`/Leave/LeaveDetails/${leaveId}`);
      if (response.data?.data) {
        const leave = response.data.data;
        setFormData({
          leave_type: leave.leave_type || '',
          start_date: leave.start_date || '',
          end_date: leave.end_date || '',
          number_of_days: leave.number_of_days?.toString() || '',
          leave_details: leave.reason || leave.leave_details || '',
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch leave details:', err);
      setError('Failed to load leave details');
    }
  };

  const fetchBlockedDates = async () => {
    try {
      // Fetch all pending/approved leaves to get blocked dates
      const response = await api.get('/Leave/LeaveList/1/1000/0');
      if (response.data?.Data) {
        const leaves = response.data.Data;
        const blocked: string[] = [];
        
        leaves.forEach((leave: any) => {
          const hodStatus = (leave.HodStatus || leave.hod_status || 'Pending').toString().toLowerCase();
          const adminStatus = (leave.AdminStatus || leave.admin_status || 'Pending').toString().toLowerCase();
          
          // Only block dates for pending or approved leaves
          if ((hodStatus === 'pending' || hodStatus === 'approved') || 
              (adminStatus === 'pending' || adminStatus === 'approved')) {
            const startDate = new Date(leave.start_date || leave.StartDate);
            const endDate = new Date(leave.end_date || leave.EndDate);
            
            // Add all dates in the range to blocked dates
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
              const dateStr = currentDate.toISOString().split('T')[0];
              if (!blocked.includes(dateStr)) {
                blocked.push(dateStr);
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });
        
        setBlockedDates(blocked);
      }
    } catch (err: any) {
      console.error('Failed to fetch blocked dates:', err);
    }
  };

  const checkOverlappingDates = async () => {
    if (!formData.start_date || !formData.end_date) {
      setOverlapError('');
      return;
    }

    try {
      const response = await api.post('/Leave/CheckOverlappingLeaves', {
        start_date: formData.start_date,
        end_date: formData.end_date,
      });

      if (response.data?.hasOverlap) {
        const overlappingLeave = response.data.overlappingLeaves[0];
        const status = overlappingLeave.hod_status === 'Approved' && overlappingLeave.admin_status === 'Approved' 
          ? 'approved' 
          : 'pending';
        setOverlapError(
          `You already have a ${overlappingLeave.leave_type} leave from ${new Date(overlappingLeave.start_date).toLocaleDateString()} to ${new Date(overlappingLeave.end_date).toLocaleDateString()} that is ${status}. Please select different dates.`
        );
      } else {
        setOverlapError('');
      }
    } catch (err: any) {
      console.error('Failed to check overlapping dates:', err);
      // Don't show error if API fails, just log it
    }
  };

  const calculateDays = () => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setFormData({ ...formData, number_of_days: diffDays.toString() });
    }
  };

  useEffect(() => {
    calculateDays();
  }, [formData.start_date, formData.end_date]);

  // Update selected leave balance when leave type changes
  useEffect(() => {
    if (formData.leave_type && leaveBalance.length > 0) {
      const balance = leaveBalance.find((b: any) => 
        (b.leave_type || '').toLowerCase() === formData.leave_type.toLowerCase()
      );
      setSelectedLeaveBalance(balance || null);
      
      // Check if balance is sufficient
      if (balance) {
        const remaining = balance.remaining_balance || 0;
        const requestedDays = parseInt(formData.number_of_days) || 0;
        
        if (remaining <= 0) {
          setBalanceError(`You have exhausted your ${formData.leave_type} balance. You have used all ${balance.total_balance || 0} days.`);
        } else if (requestedDays > remaining) {
          setBalanceError(`Insufficient leave balance. You have ${remaining} day(s) remaining, but requested ${requestedDays} day(s).`);
        } else {
          setBalanceError('');
        }
      } else {
        setBalanceError(`No leave balance found for ${formData.leave_type}. Please contact HR.`);
      }
      
      // Check if all leave types are exhausted
      const allExhausted = leaveBalance.every((b: any) => (b.remaining_balance || 0) <= 0);
      if (allExhausted && leaveBalance.length > 0) {
        setBalanceError('All your leave types have been exhausted. You cannot apply for leave at this time.');
      }
    } else {
      setSelectedLeaveBalance(null);
      setBalanceError('');
    }
  }, [formData.leave_type, formData.number_of_days, leaveBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setBalanceError('');
    setOverlapError('');

    // Check for overlapping dates before submission
    if (formData.start_date && formData.end_date) {
      try {
        const overlapResponse = await api.post('/Leave/CheckOverlappingLeaves', {
          start_date: formData.start_date,
          end_date: formData.end_date,
          ...(isUpdate && leaveId ? { leave_id: leaveId } : {}),
        });

        if (overlapResponse.data?.hasOverlap) {
          const overlappingLeave = overlapResponse.data.overlappingLeaves[0];
          const status = overlappingLeave.hod_status === 'Approved' && overlappingLeave.admin_status === 'Approved' 
            ? 'approved' 
            : 'pending';
          setOverlapError(
            `You already have a ${overlappingLeave.leave_type} leave from ${new Date(overlappingLeave.start_date).toLocaleDateString()} to ${new Date(overlappingLeave.end_date).toLocaleDateString()} that is ${status}. Please select different dates.`
          );
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.error('Failed to check overlapping dates:', err);
        // Continue with submission if check fails (backend will validate)
      }
    }

    // Validate leave balance before submission (only for new leaves, not updates)
    if (!isUpdate && formData.leave_type && selectedLeaveBalance) {
      const remaining = selectedLeaveBalance.remaining_balance || 0;
      const requestedDays = parseInt(formData.number_of_days) || 0;
      
      if (remaining <= 0) {
        setBalanceError(`You have exhausted your ${formData.leave_type} balance. Cannot apply for this leave type.`);
        setLoading(false);
        return;
      }
      
      if (requestedDays > remaining) {
        setBalanceError(`Cannot apply for ${requestedDays} days. You only have ${remaining} day(s) remaining for ${formData.leave_type}.`);
        setLoading(false);
        return;
      }
    }
    
    // Check if all leave types are exhausted
    if (!isUpdate && leaveBalance.length > 0) {
      const allExhausted = leaveBalance.every((b: any) => (b.remaining_balance || 0) <= 0);
      if (allExhausted) {
        setBalanceError('All your leave types have been exhausted. You cannot apply for leave at this time.');
        setLoading(false);
        return;
      }
    }

    try {
      if (isUpdate) {
        await api.patch(`/Leave/LeaveUpdate/${leaveId}`, formData);
      } else {
        await api.post('/Leave/LeaveCreate', formData);
      }
      router.push('/dashboard/leaves');
    } catch (err: any) {
      console.error('Leave application error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(err.response?.data?.message || 'Failed to submit leave application');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageTitle
        breadCrumbItems={[
          { label: 'Leave', path: '/dashboard/leaves' },
          {
            label: isUpdate ? 'Update Leave' : 'Create Leave',
            path: '/dashboard/apply-leave',
            active: true,
          },
        ]}
        title={isUpdate ? 'Update Leave' : 'Create Leave'}
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
              {/* Leave Type */}
              <div>
                <label htmlFor="leave_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="leave_type"
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  required
                  disabled={isUpdate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                
                {/* Show Leave Balance */}
                {!isUpdate && selectedLeaveBalance && (
                  <div className={`mt-2 p-3 rounded-lg border ${
                    selectedLeaveBalance.remaining_balance > 0 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Remaining Balance:</span>
                      <span className={`text-sm font-bold ${
                        selectedLeaveBalance.remaining_balance > 0 
                          ? 'text-green-700' 
                          : 'text-red-700'
                      }`}>
                        {selectedLeaveBalance.remaining_balance || 0} / {selectedLeaveBalance.total_balance || 0} days
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Used: {selectedLeaveBalance.used_balance || 0} days
                    </div>
                  </div>
                )}
                
                {!isUpdate && formData.leave_type && !selectedLeaveBalance && leaveBalance.length > 0 && (
                  <div className="mt-2 p-3 rounded-lg border bg-yellow-50 border-yellow-200">
                    <p className="text-sm text-yellow-700">
                      No leave balance found for this leave type. Please contact HR to set up your leave balance.
                    </p>
                  </div>
                )}
              </div>

              {/* Number of Days - Auto-calculated, Read-only */}
              <div>
                <label htmlFor="number_of_days" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Days
                  {selectedLeaveBalance && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      (Max: {selectedLeaveBalance.remaining_balance || 0} days available)
                    </span>
                  )}
                </label>
                <input
                  id="number_of_days"
                  type="number"
                  value={formData.number_of_days}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed text-sm"
                  title="Number of days is automatically calculated based on start and end dates"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Automatically calculated from start and end dates
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date */}
              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Leave Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm ${
                    overlapError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {overlapError && formData.start_date && (
                  <p className="mt-1 text-xs text-red-600">{overlapError}</p>
                )}
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                  End Leave Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                  min={formData.start_date || new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm ${
                    overlapError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {overlapError && formData.end_date && (
                  <p className="mt-1 text-xs text-red-600">{overlapError}</p>
                )}
              </div>
            </div>

            {/* Leave Details */}
            <div>
              <label htmlFor="leave_details" className="block text-sm font-medium text-gray-700 mb-2">
                Leave Details <span className="text-red-500">*</span>
              </label>
              <textarea
                id="leave_details"
                value={formData.leave_details}
                onChange={(e) => setFormData({ ...formData, leave_details: e.target.value })}
                required
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-none text-sm"
                placeholder="Enter leave details..."
              />
            </div>

            {/* Balance Error Message */}
            {balanceError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm">{balanceError}</p>
                </div>
              </div>
            )}

            {/* Overlap Error Message */}
            {overlapError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm">{overlapError}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-4">
              <button
                type="submit"
                disabled={loading || (!isUpdate && balanceError !== '') || overlapError !== ''}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {loading ? 'Submitting...' : isUpdate ? 'Update Leave' : 'Apply for Leave'}
              </button>
              {!isUpdate && (balanceError || overlapError) && (
                <p className="mt-2 text-xs text-gray-500">
                  {balanceError ? 'Please adjust your leave request or contact HR to increase your leave balance.' : ''}
                  {overlapError ? 'Please select different dates that do not overlap with existing leaves.' : ''}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

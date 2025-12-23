'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CalendarDays, Lock } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [leaveBalance, setLeaveBalance] = useState<any[]>([]);
  const [takenLeaves, setTakenLeaves] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Generate year options (current year and previous 2 years, next year)
  const yearOptions = [];
  for (let i = currentYear - 2; i <= currentYear + 1; i++) {
    yearOptions.push(i);
  }

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchLeaveBalance();
    fetchTakenLeaves();
  }, [selectedYear, userRole]);

  const fetchCurrentUser = async () => {
    try {
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get('/Auth/Me'),
        api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } }))
      ]);
      
      if (userResponse.data?.user) {
        setUserRole(userResponse.data.user.role?.toLowerCase() || 'employee');
      }
      
      if (permissionsResponse.data?.data) {
        setUserPermissions(permissionsResponse.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await api.get('/Leave/LeaveBalance', {
        params: { year: selectedYear }
      });
      if (response.data?.data) {
        setLeaveBalance(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch leave balance:', error);
    }
  };

  const fetchTakenLeaves = async () => {
    try {
      // Fetch approved leaves for the selected year
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      const response = await api.get('/Leave/LeaveList/1/1000/0');
      const allLeaves = response.data?.Data || response.data?.data || [];
      
      // Filter for approved leaves in the selected year
      const approvedLeaves = allLeaves.filter((leave: any) => {
        const leaveDate = new Date(leave.start_date);
        const leaveYear = leaveDate.getFullYear();
        const isApproved = (leave.status === 'Approved' || 
                           (leave.hod_status === 'Approved' && leave.admin_status === 'Approved'));
        return isApproved && leaveYear === selectedYear;
      });
      
      // Sort by start date (most recent first)
      approvedLeaves.sort((a: any, b: any) => {
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });
      
      setTakenLeaves(approvedLeaves);
    } catch (error: any) {
      console.error('Failed to fetch taken leaves:', error);
      setTakenLeaves([]);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setPasswordLoading(true);
    try {
      // Use the existing Change Password endpoint (if it exists) or ResetPassword pattern
      // Adjust the endpoint based on your existing API
      const response = await api.post('/Auth/ChangePassword', {
        current_password: currentPassword,
        new_password: newPassword
      });
      
      setPasswordSuccess(response.data?.message || 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        setPasswordSuccess('');
      }, 3000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || err.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="page-container space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Leave Balance & History</h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {yearOptions.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Year-to-Date (YTD) leave balance and history for {selectedYear}
        </p>
        
        {leaveBalance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-600 text-sm font-medium border-b">
                  <th className="pb-3">Leave Type</th>
                  <th className="pb-3">Total Balance</th>
                  <th className="pb-3">Used</th>
                  <th className="pb-3">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {leaveBalance.map((balance: any, index: number) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 text-gray-900 font-medium">{balance.leave_type}</td>
                    <td className="py-3 text-gray-700">{balance.total_balance || 0}</td>
                    <td className="py-3 text-gray-700">{balance.used_balance || 0}</td>
                    <td className="py-3">
                      <span className={`font-semibold ${
                        (balance.remaining_balance || 0) > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {balance.remaining_balance || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">No leave balance data available for {selectedYear}</p>
          </div>
        )}
      </div>

      {/* Already Taken Leaves */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Already Taken Leaves ({selectedYear})</h2>
        
        {takenLeaves.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-600 text-sm font-medium border-b">
                  <th className="pb-3">Leave Type</th>
                  <th className="pb-3">Start Date</th>
                  <th className="pb-3">End Date</th>
                  <th className="pb-3">Duration</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {takenLeaves.map((leave: any) => {
                  const startDate = new Date(leave.start_date);
                  const endDate = new Date(leave.end_date);
                  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  
                  return (
                    <tr key={leave.id || leave._id} className="border-b hover:bg-gray-50">
                      <td className="py-3 text-gray-900 font-medium">{leave.leave_type || leave.LeaveType || 'N/A'}</td>
                      <td className="py-3 text-gray-700">
                        {startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 text-gray-700">
                        {endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 text-gray-700">{daysDiff} {daysDiff === 1 ? 'day' : 'days'}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                          Approved
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">No approved leaves found for {selectedYear}</p>
          </div>
        )}
      </div>

      {/* Change Password Section - Only if user has settings.edit permission or is Admin */}
      {(userRole === 'admin' || userPermissions.includes('settings.edit')) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
          </div>
        
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          {passwordError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{passwordError}</p>
            </div>
          )}
          
          {passwordSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{passwordSuccess}</p>
            </div>
          )}

          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="form-input"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {passwordLoading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
        </div>
      )}
    </div>
  );
}

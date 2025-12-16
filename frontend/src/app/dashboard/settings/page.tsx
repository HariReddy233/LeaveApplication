'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [authStats, setAuthStats] = useState<any>(null);
  const [leaveBalance, setLeaveBalance] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);

  // Generate year options (current year and previous 2 years, next year)
  const yearOptions = [];
  for (let i = currentYear - 2; i <= currentYear + 1; i++) {
    yearOptions.push(i);
  }

  useEffect(() => {
    fetchAuthStats();
    fetchLeaveBalance();
  }, [selectedYear]);

  const fetchAuthStats = async () => {
    try {
      const response = await api.get('/Authorization/AuthorizationStats');
      if (response.data?.data) {
        setAuthStats(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch authorization stats:', error);
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Settings
        </h1>
        <p className="text-gray-600 text-sm" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Configure system settings
        </p>
      </div>

      {/* Authorization Management Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Authorization Management</h2>
        </div>
        
        {loading ? (
          <div className="text-gray-600 text-sm">Loading...</div>
        ) : authStats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-gray-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Total Requests</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{authStats.total_count || 0}</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Pending</h3>
                </div>
                <p className="text-2xl font-bold text-yellow-800">{authStats.pending_count || 0}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Approved</h3>
                </div>
                <p className="text-2xl font-bold text-green-800">{authStats.approved_count || 0}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Rejected</h3>
                </div>
                <p className="text-2xl font-bold text-red-800">{authStats.rejected_count || 0}</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => router.push('/dashboard/authorizations')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View My Authorizations
              </button>
              <button
                onClick={() => router.push('/dashboard/apply-authorization')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Request New Authorization
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">No authorization data available</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Leave Balance</h2>
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

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Leave Management Settings</h2>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Calendar Creation</h3>
            <p className="text-sm text-gray-600">
              Create and manage calendar templates that can be assigned to employees
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Email Notifications</h3>
            <p className="text-sm text-gray-600">
              Configure email notifications for leave applications and approvals
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Shift Management Settings</h2>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Shift management configuration will be available here</p>
        </div>
      </div>
    </div>
  );
}







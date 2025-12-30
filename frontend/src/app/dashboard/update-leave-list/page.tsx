'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import Button from '@/components/Common/Button';
import { Calendar, X, Plus, Edit2, Trash2, Users, Building2, Lock } from 'lucide-react';

interface OrganizationHoliday {
  id: number;
  holiday_name: string;
  holiday_date: string;
  is_recurring: boolean;
  recurring_year: number | null;
  created_at: string;
  team?: string; // 'all', 'US', or 'IN'
  type?: string; // 'organization_holiday' or 'country_holiday'
}

interface Employee {
  employee_id: number | string;
  employee_name?: string;
  full_name?: string;
  email: string;
  user_id?: number;
}

interface EmployeeBlockedDate {
  id: number;
  employee_id: number;
  blocked_date: string;
  reason: string | null;
  blocked_by_name: string | null;
}

export default function UpdateLeaveListPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'holidays' | 'employees'>('holidays');
  const [holidays, setHolidays] = useState<OrganizationHoliday[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeBlockedDates, setEmployeeBlockedDates] = useState<EmployeeBlockedDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [hasAccess, setHasAccess] = useState<boolean>(false);

  // Holiday form state
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<OrganizationHoliday | null>(null);
  const [holidayForm, setHolidayForm] = useState({
    holiday_name: '',
    holiday_date: '',
    is_recurring: false,
    recurring_year: '',
    team: 'all', // 'all' for organization holiday, 'US' for US team, 'IN' for India team
  });
  
  // Bulk entry state
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single');
  const [bulkHolidays, setBulkHolidays] = useState<Array<{
    holiday_name: string;
    holiday_date: string;
    team: string;
    description?: string;
  }>>([{ holiday_name: '', holiday_date: '', team: 'all', description: '' }]);

  // Employee blocked date form state
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    employee_id: '',
    blocked_dates: [] as string[],
    reason: '',
  });
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchHolidays();
      fetchEmployees();
      if (activeTab === 'employees') {
        fetchEmployeeBlockedDates();
      }
    }
  }, [activeTab, hasAccess]);

  const checkPermissions = async () => {
    try {
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get('/Auth/Me'),
        api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } }))
      ]);
      
      if (userResponse.data?.user?.role) {
        const role = userResponse.data.user.role.toLowerCase();
        setUserRole(role);
        
        // Admin always has access
        // HOD needs leave.update_list permission
        const permissions = permissionsResponse.data?.data || [];
        setUserPermissions(permissions);
        
        const hasUpdateListPermission = permissions.includes('leave.update_list');
        const isAdmin = role === 'admin';
        
        if (isAdmin || hasUpdateListPermission) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
          setError('You do not have permission to access Update Leave List. Please contact your administrator.');
        }
      }
    } catch (err: any) {
      console.error('Failed to check permissions:', err);
      if (err.response?.status === 401) {
        router.push('/login');
      } else {
        setError('Failed to verify permissions. Please try again.');
      }
    }
  };

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const response = await api.get('/Calendar/OrganizationHolidays');
      if (response.data?.data) {
        setHolidays(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch holidays:', err);
      setError(err.response?.data?.message || 'Failed to fetch holidays');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/User/EmployeeList');
      // Handle multiple response formats like the employees page does
      const employeesList = response.data?.data || response.data?.Data || response.data || [];
      
      // Map the response to match our interface
      const mappedEmployees = employeesList.map((emp: any) => ({
        employee_id: emp.employee_id || emp.user_id || emp.id,
        employee_name: emp.employee_name || emp.full_name || emp.email,
        full_name: emp.full_name || emp.employee_name || emp.email,
        email: emp.email,
        user_id: emp.user_id || emp.id
      }));
      
      setEmployees(mappedEmployees);
    } catch (err: any) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
    }
  };

  const fetchEmployeeBlockedDates = async () => {
    try {
      const response = await api.get('/Calendar/EmployeeBlockedDates');
      if (response.data?.data) {
        setEmployeeBlockedDates(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch employee blocked dates:', err);
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setLoading(true);
      const payload = {
        holiday_name: holidayForm.holiday_name,
        holiday_date: holidayForm.holiday_date,
        is_recurring: holidayForm.is_recurring,
        recurring_year: holidayForm.recurring_year ? parseInt(holidayForm.recurring_year) : null,
        team: holidayForm.team, // 'all', 'US', or 'IN'
      };

      if (editingHoliday) {
        await api.put(`/Calendar/OrganizationHoliday/${editingHoliday.id}`, payload);
        setSuccess('Holiday updated successfully');
      } else {
        await api.post('/Calendar/OrganizationHoliday', payload);
        setSuccess('Holiday created successfully');
      }

      setShowHolidayForm(false);
      setEditingHoliday(null);
      setHolidayForm({
        holiday_name: '',
        holiday_date: '',
        is_recurring: false,
        recurring_year: '',
        team: 'all',
      });
      fetchHolidays();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save holiday');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSave = async () => {
    setError('');
    setSuccess('');

    // Filter out empty rows
    const validHolidays = bulkHolidays.filter(
      (h) => h.holiday_name.trim() !== '' && h.holiday_date !== ''
    );

    if (validHolidays.length === 0) {
      setError('Please add at least one holiday with all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/Calendar/BulkOrganizationHolidays', {
        holidays: validHolidays.map((h) => ({
          holiday_name: h.holiday_name.trim(),
          holiday_date: h.holiday_date,
          team: h.team,
          description: h.description?.trim() || null,
        })),
      });

      setSuccess(response.data?.message || `Successfully created ${validHolidays.length} holiday(s)`);
      setShowHolidayForm(false);
      setBulkHolidays([{ holiday_name: '', holiday_date: '', team: 'all', description: '' }]);
      setEntryMode('single');
      fetchHolidays();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save bulk holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (holiday: OrganizationHoliday) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    try {
      setLoading(true);
      // If it's a country-specific holiday, use different endpoint
      if (holiday.type === 'country_holiday' || (holiday.team && holiday.team !== 'all')) {
        await api.delete(`/Calendar/CountryHoliday/${holiday.id}?country_code=${holiday.team}`);
      } else {
        await api.delete(`/Calendar/OrganizationHoliday/${holiday.id}`);
      }
      setSuccess('Holiday deleted successfully');
      fetchHolidays();
    } catch (err: any) {
      console.error('Failed to delete holiday:', err);
      
      // Handle different error types correctly
      if (err.response?.status === 401) {
        // 401 = Authentication failed - redirect to login
        setError('Session expired. Please login again.');
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
          }
        }, 2000);
      } else if (err.response?.status === 403) {
        // 403 = Permission denied - show error but don't redirect
        const errorMsg = err.response?.data?.message || 'You do not have permission to delete holidays. Please contact your administrator.';
        setError(`Access denied: ${errorMsg}`);
      } else {
        // Other errors
        setError(err.response?.data?.message || 'Failed to delete holiday');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditHoliday = (holiday: OrganizationHoliday) => {
    setEditingHoliday(holiday);
    setEntryMode('single'); // Always use single mode for editing
    setHolidayForm({
      holiday_name: holiday.holiday_name,
      holiday_date: holiday.holiday_date.split('T')[0],
      is_recurring: holiday.is_recurring,
      recurring_year: holiday.recurring_year?.toString() || '',
      team: holiday.team || 'all',
    });
    setShowHolidayForm(true);
  };

  const handleBlockEmployeeDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!employeeForm.employee_id || employeeForm.blocked_dates.length === 0) {
      setError('Please select an employee and at least one date');
      return;
    }

    try {
      setLoading(true);
      await api.post('/Calendar/BlockEmployeeDates', {
        employee_id: parseInt(employeeForm.employee_id),
        blocked_dates: employeeForm.blocked_dates,
        reason: employeeForm.reason || null,
      });

      setSuccess('Employee dates blocked successfully');
      setShowEmployeeForm(false);
      setEmployeeForm({
        employee_id: '',
        blocked_dates: [],
        reason: '',
      });
      setSelectedDate('');
      fetchEmployeeBlockedDates();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to block employee dates');
    } finally {
      setLoading(false);
    }
  };

  const addDateToBlock = () => {
    if (selectedDate && !employeeForm.blocked_dates.includes(selectedDate)) {
      setEmployeeForm({
        ...employeeForm,
        blocked_dates: [...employeeForm.blocked_dates, selectedDate],
      });
      setSelectedDate('');
    }
  };

  const removeDateFromBlock = (date: string) => {
    setEmployeeForm({
      ...employeeForm,
      blocked_dates: employeeForm.blocked_dates.filter(d => d !== date),
    });
  };

  const handleDeleteEmployeeBlockedDate = async (id: number) => {
    if (!confirm('Are you sure you want to remove this blocked date?')) return;

    try {
      setLoading(true);
      await api.delete(`/Calendar/EmployeeBlockedDate/${id}`);
      setSuccess('Blocked date removed successfully');
      fetchEmployeeBlockedDates();
    } catch (err: any) {
      console.error('Failed to delete employee blocked date:', err);
      
      // Handle different error types correctly
      if (err.response?.status === 401) {
        // 401 = Authentication failed - redirect to login
        setError('Session expired. Please login again.');
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
          }
        }, 2000);
      } else if (err.response?.status === 403) {
        // 403 = Permission denied - show error but don't redirect
        const errorMsg = err.response?.data?.message || 'You do not have permission to delete blocked dates. Please contact your administrator.';
        setError(`Access denied: ${errorMsg}`);
      } else {
        // Other errors
        setError(err.response?.data?.message || 'Failed to remove blocked date');
      }
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find(e => 
      (e.employee_id && e.employee_id.toString() === employeeId.toString()) || 
      (e.user_id && e.user_id.toString() === employeeId.toString())
    );
    return employee?.employee_name || employee?.full_name || employee?.email || `Employee #${employeeId}`;
  };

  if (!hasAccess && userRole) {
    return (
      <div className="space-y-6">
        <PageTitle title="Organization Holidays" description="Manage organization holidays" />
        <div className="card">
          <div className="p-6 text-center">
            <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600">You do not have permission to access Organization Holidays. Please contact your administrator.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Organization Holidays" description="Manage organization holidays and employee blocked dates" />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('holidays')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'holidays'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="inline w-4 h-4 mr-2" />
            Organization Holidays
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'employees'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="inline w-4 h-4 mr-2" />
            Employee Blocked Dates
          </button>
        </nav>
      </div>

      {/* Organization Holidays Tab */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Organization Holidays</h2>
            {(userRole === 'admin' || userPermissions.includes('leave.update_list')) && (
              <Button
                onClick={() => {
                  setEditingHoliday(null);
                  setEntryMode('single');
                  setHolidayForm({
                    holiday_name: '',
                    holiday_date: '',
                    is_recurring: false,
                    recurring_year: '',
                    team: 'all',
                  });
                  setBulkHolidays([{ holiday_name: '', holiday_date: '', team: 'all', description: '' }]);
                  setShowHolidayForm(true);
                }}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Holiday
              </Button>
            )}
          </div>

          {/* Holiday Form */}
          {showHolidayForm && (
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">
                {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
              </h3>
              
              {/* Entry Mode Tabs - Only show when not editing */}
              {!editingHoliday && (
                <div className="border-b border-gray-200 mb-4">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      type="button"
                      onClick={() => setEntryMode('single')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        entryMode === 'single'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Single Holiday
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode('bulk')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        entryMode === 'bulk'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Bulk Holiday Entry
                    </button>
                  </nav>
                </div>
              )}
              
              {/* Single Holiday Form */}
              {entryMode === 'single' && (
                <form onSubmit={handleCreateHoliday} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Holiday Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={holidayForm.holiday_name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, holiday_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., New Year, Christmas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Holiday Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={holidayForm.holiday_date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team/Country *
                  </label>
                  <select
                    required
                    value={holidayForm.team}
                    onChange={(e) => setHolidayForm({ ...holidayForm, team: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Teams (Organization Holiday)</option>
                    <option value="US">US Team</option>
                    <option value="IN">India Team</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Select which team(s) this holiday applies to
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_recurring"
                    checked={holidayForm.is_recurring}
                    onChange={(e) => setHolidayForm({ ...holidayForm, is_recurring: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_recurring" className="ml-2 block text-sm text-gray-700">
                    Recurring Holiday (every year)
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {editingHoliday ? 'Update' : 'Create'} Holiday
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowHolidayForm(false);
                      setEditingHoliday(null);
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
              )}
              
              {/* Bulk Holiday Entry Form */}
              {entryMode === 'bulk' && (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Date *
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Holiday Name *
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Country / Team *
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {bulkHolidays.map((holiday, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 border-r border-gray-300">
                              <input
                                type="date"
                                required
                                value={holiday.holiday_date}
                                onChange={(e) => {
                                  const updated = [...bulkHolidays];
                                  updated[index].holiday_date = e.target.value;
                                  setBulkHolidays(updated);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2 border-r border-gray-300">
                              <input
                                type="text"
                                required
                                value={holiday.holiday_name}
                                onChange={(e) => {
                                  const updated = [...bulkHolidays];
                                  updated[index].holiday_name = e.target.value;
                                  setBulkHolidays(updated);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="e.g., New Year"
                              />
                            </td>
                            <td className="px-4 py-2 border-r border-gray-300">
                              <select
                                required
                                value={holiday.team}
                                onChange={(e) => {
                                  const updated = [...bulkHolidays];
                                  updated[index].team = e.target.value;
                                  setBulkHolidays(updated);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              >
                                <option value="all">All Teams</option>
                                <option value="US">US Team</option>
                                <option value="IN">India Team</option>
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={holiday.description || ''}
                                onChange={(e) => {
                                  const updated = [...bulkHolidays];
                                  updated[index].description = e.target.value;
                                  setBulkHolidays(updated);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Optional"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (bulkHolidays.length > 1) {
                                    setBulkHolidays(bulkHolidays.filter((_, i) => i !== index));
                                  }
                                }}
                                className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                                disabled={bulkHolidays.length === 1}
                                title="Remove row"
                              >
                                <X className="w-4 h-4 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      onClick={() => {
                        setBulkHolidays([...bulkHolidays, { holiday_name: '', holiday_date: '', team: 'all', description: '' }]);
                      }}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Row
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleBulkSave}
                        disabled={loading}
                      >
                        Save All Holidays
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setShowHolidayForm(false);
                          setEditingHoliday(null);
                          setBulkHolidays([{ holiday_name: '', holiday_date: '', team: 'all', description: '' }]);
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Holidays List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Holiday Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Country / Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {(userRole === 'admin' || userPermissions.includes('leave.update_list')) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={userRole === 'admin' || userPermissions.includes('calendar.block_dates') ? 5 : 4} className="px-6 py-4 text-center text-gray-500">
                      No holidays found. {(userRole === 'admin' || userPermissions.includes('calendar.block_dates')) && 'Add your first holiday above.'}
                    </td>
                  </tr>
                ) : (
                  holidays.map((holiday) => (
                    <tr key={holiday.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(holiday.holiday_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {holiday.holiday_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {holiday.team === 'all' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            All Teams
                          </span>
                        ) : holiday.team === 'US' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            United States
                          </span>
                        ) : holiday.team === 'IN' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            India
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            All Teams
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {holiday.is_recurring ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Active (Recurring)
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Active
                          </span>
                        )}
                      </td>
                      {(userRole === 'admin' || userPermissions.includes('leave.update_list')) && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-3">
                            {holiday.type !== 'country_holiday' && (
                              <button
                                onClick={() => handleEditHoliday(holiday)}
                                className="text-blue-600 hover:text-blue-900 transition-colors"
                                title="Edit holiday"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteHoliday(holiday)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              title="Delete holiday"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee Blocked Dates Tab */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Employee Blocked Dates</h2>
            <Button
              onClick={() => {
                setEmployeeForm({
                  employee_id: '',
                  blocked_dates: [],
                  reason: '',
                });
                setShowEmployeeForm(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Block Employee Dates
            </Button>
          </div>

          {/* Employee Blocked Date Form */}
          {showEmployeeForm && (
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Block Employee Dates</h3>
              <form onSubmit={handleBlockEmployeeDates} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee *
                  </label>
                  <select
                    required
                    value={employeeForm.employee_id}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an employee</option>
                    {employees.map((emp) => (
                      <option key={emp.employee_id || emp.user_id} value={emp.employee_id || emp.user_id}>
                        {emp.employee_name || emp.full_name || emp.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Block Date
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      type="button"
                      onClick={addDateToBlock}
                      disabled={!selectedDate}
                    >
                      Add Date
                    </Button>
                  </div>
                </div>

                {employeeForm.blocked_dates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Selected Dates
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {employeeForm.blocked_dates.map((date) => (
                        <span
                          key={date}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {new Date(date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                          <button
                            type="button"
                            onClick={() => removeDateFromBlock(date)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (optional)
                  </label>
                  <textarea
                    value={employeeForm.reason}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Reason for blocking these dates..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading || employeeForm.blocked_dates.length === 0}>
                    Block Dates
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowEmployeeForm(false);
                      setEmployeeForm({
                        employee_id: '',
                        blocked_dates: [],
                        reason: '',
                      });
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Employee Blocked Dates List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Blocked Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employeeBlockedDates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No employee blocked dates found.
                    </td>
                  </tr>
                ) : (
                  employeeBlockedDates.map((blocked) => (
                    <tr key={blocked.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getEmployeeName(blocked.employee_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(blocked.blocked_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {blocked.reason || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteEmployeeBlockedDate(blocked.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


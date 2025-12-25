'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import Button from '@/components/Common/Button';
import { Calendar, X, Plus, Edit2, Trash2, Users, Building2 } from 'lucide-react';

interface OrganizationHoliday {
  id: number;
  holiday_name: string;
  holiday_date: string;
  is_recurring: boolean;
  recurring_year: number | null;
  created_at: string;
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

  // Holiday form state
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<OrganizationHoliday | null>(null);
  const [holidayForm, setHolidayForm] = useState({
    holiday_name: '',
    holiday_date: '',
    is_recurring: false,
    recurring_year: '',
  });

  // Employee blocked date form state
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    employee_id: '',
    blocked_dates: [] as string[],
    reason: '',
  });
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    fetchHolidays();
    fetchEmployees();
    if (activeTab === 'employees') {
      fetchEmployeeBlockedDates();
    }
  }, [activeTab]);

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
      });
      fetchHolidays();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save holiday');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    try {
      setLoading(true);
      await api.delete(`/Calendar/OrganizationHoliday/${id}`);
      setSuccess('Holiday deleted successfully');
      fetchHolidays();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete holiday');
    } finally {
      setLoading(false);
    }
  };

  const handleEditHoliday = (holiday: OrganizationHoliday) => {
    setEditingHoliday(holiday);
    setHolidayForm({
      holiday_name: holiday.holiday_name,
      holiday_date: holiday.holiday_date.split('T')[0],
      is_recurring: holiday.is_recurring,
      recurring_year: holiday.recurring_year?.toString() || '',
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
      setError(err.response?.data?.message || 'Failed to remove blocked date');
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

  return (
    <div className="space-y-6">
      <PageTitle title="Update Leave List" description="Manage organization holidays and employee blocked dates" />

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
            <Button
              onClick={() => {
                setEditingHoliday(null);
                setHolidayForm({
                  holiday_name: '',
                  holiday_date: '',
                  is_recurring: false,
                  recurring_year: '',
                });
                setShowHolidayForm(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Holiday
            </Button>
          </div>

          {/* Holiday Form */}
          {showHolidayForm && (
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">
                {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
              </h3>
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

                {!holidayForm.is_recurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year (optional, leave empty for current year)
                    </label>
                    <input
                      type="number"
                      value={holidayForm.recurring_year}
                      onChange={(e) => setHolidayForm({ ...holidayForm, recurring_year: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 2024"
                    />
                  </div>
                )}

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
            </div>
          )}

          {/* Holidays List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Holiday Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No holidays found. Add your first holiday above.
                    </td>
                  </tr>
                ) : (
                  holidays.map((holiday) => (
                    <tr key={holiday.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {holiday.holiday_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(holiday.holiday_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {holiday.is_recurring ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Recurring
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            One-time
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditHoliday(holiday)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDeleteHoliday(holiday.id)}
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


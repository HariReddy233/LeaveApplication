'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import { Plus, Trash2, Calendar, Edit, FileText, Users } from 'lucide-react';

export default function UpdateLeaveListPage() {
  const router = useRouter();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'holidays' | 'blocked'>('holidays');
  const [holidayFormTab, setHolidayFormTab] = useState<'single' | 'bulk'>('single');
  const [holidayFormData, setHolidayFormData] = useState({
    name: '',
    date: '',
    country_code: '',
    is_recurring: false,
  });
  const [bulkHolidays, setBulkHolidays] = useState<Array<{name: string, date: string, country_code: string}>>([
    { name: '', date: '', country_code: '' }
  ]);
  const [creatingHoliday, setCreatingHoliday] = useState(false);
  const [creatingBulk, setCreatingBulk] = useState(false);
  const [holidayError, setHolidayError] = useState('');
  
  // Blocked Dates Form State
  const [blockedFormData, setBlockedFormData] = useState({
    employee_id: '',
    dates: [''],
    reason: '',
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [creatingBlocked, setCreatingBlocked] = useState(false);
  const [blockedError, setBlockedError] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('');

  useEffect(() => {
    fetchUserRole();
    fetchData(); // Fetch data immediately, don't wait for userRole
    if (activeTab === 'blocked') {
      fetchEmployees();
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (activeTab === 'blocked') {
      fetchEmployees();
    }
  }, [activeTab, locationFilter]);
  
  // Also fetch employees when location filter changes (for blocked dates tab)
  useEffect(() => {
    if (activeTab === 'blocked') {
      fetchEmployees();
    }
  }, [locationFilter]);

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

  const fetchEmployees = async () => {
    try {
      // Build query params with location filter
      const params = new URLSearchParams();
      if (locationFilter && locationFilter !== 'All') {
        params.append('location', locationFilter);
      }
      const queryString = params.toString();
      const url = `/User/EmployeeList${queryString ? '?' + queryString : ''}`;
      const response = await api.get(url).catch(() => ({ data: { data: [] } }));
      const employeesData = response.data?.data || response.data?.Data || response.data || [];
      setEmployees(employeesData);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'holidays') {
        console.log('📅 Fetching organization holidays...');
        // Build query params with location filter
        const params = new URLSearchParams();
        if (locationFilter && locationFilter !== 'All') {
          params.append('location', locationFilter);
        }
        const queryString = params.toString();
        const url = `/Calendar/OrganizationHolidays${queryString ? '?' + queryString : ''}`;
        const response = await api.get(url).catch((err) => {
          console.error('Error fetching holidays:', err);
          return { data: { data: [] } };
        });
        const holidaysData = response.data?.data || response.data || [];
        console.log(`✅ Fetched ${holidaysData.length} holidays`);
        setHolidays(holidaysData);
      } else {
        console.log('🚫 Fetching blocked dates...');
        const response = await api.get('/Calendar/AllBlockedDates').catch((err) => {
          console.error('Error fetching blocked dates:', err);
          return { data: { data: [] } };
        });
        const blockedData = response.data?.data || response.data || [];
        console.log(`✅ Fetched ${blockedData.length} blocked dates`);
        setBlockedDates(blockedData);
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      if (activeTab === 'holidays') {
        setHolidays([]);
      } else {
        setBlockedDates([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      await api.delete(`/Calendar/OrganizationHoliday/${id}`);
      alert('Holiday deleted successfully');
      fetchData();
    } catch (err: any) {
      console.error('Failed to delete holiday:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to delete holiday. Please try again.';
      alert(errorMsg);
    }
  };

  const handleDeleteBlockedDate = async (blocked: any) => {
    if (!confirm('Are you sure you want to delete this blocked date?')) {
      return;
    }

    try {
      // Check if it's an organization holiday or employee blocked date
      if (blocked.type === 'organization_holiday') {
        await api.delete(`/Calendar/OrganizationHoliday/${blocked.id}`);
      } else {
        // Employee blocked date
        await api.delete(`/Calendar/EmployeeBlockedDate/${blocked.id}`);
      }
      alert('Blocked date deleted successfully');
      fetchData();
    } catch (err: any) {
      console.error('Failed to delete blocked date:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to delete blocked date. Please try again.';
      alert(errorMsg);
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingHoliday(true);
    setHolidayError('');

    if (!holidayFormData.name || !holidayFormData.date) {
      setHolidayError('Holiday name and date are required');
      setCreatingHoliday(false);
      return;
    }

    try {
      await api.post('/Calendar/OrganizationHoliday', {
        name: holidayFormData.name,
        date: holidayFormData.date,
        country_code: holidayFormData.country_code || null,
        is_recurring: holidayFormData.is_recurring,
      });
      
      alert('Holiday created successfully!');
      // Reset form
      setHolidayFormData({
        name: '',
        date: '',
        country_code: '',
        is_recurring: false,
      });
      fetchData();
    } catch (err: any) {
      console.error('Holiday creation error:', err);
      if (err.response?.status === 401) {
        setHolidayError('Session expired. Please login again.');
      } else if (err.response?.status === 403) {
        setHolidayError(err.response?.data?.message || 'You do not have permission to create holidays.');
      } else {
        setHolidayError(err.response?.data?.error || err.response?.data?.message || 'Failed to create holiday');
      }
    } finally {
      setCreatingHoliday(false);
    }
  };

  const handleAddBulkRow = () => {
    setBulkHolidays([...bulkHolidays, { name: '', date: '', country_code: '' }]);
  };

  const handleRemoveBulkRow = (index: number) => {
    if (bulkHolidays.length > 1) {
      setBulkHolidays(bulkHolidays.filter((_, i) => i !== index));
    }
  };

  const handleBulkHolidayChange = (index: number, field: string, value: string) => {
    const updated = [...bulkHolidays];
    updated[index] = { ...updated[index], [field]: value };
    setBulkHolidays(updated);
  };

  const handleCreateBulkHolidays = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBulk(true);
    setHolidayError('');

    // Filter out empty rows
    const validHolidays = bulkHolidays.filter(h => h.name && h.date);
    
    if (validHolidays.length === 0) {
      setHolidayError('Please add at least one holiday with name and date');
      setCreatingBulk(false);
      return;
    }

    try {
      await api.post('/Calendar/BulkOrganizationHolidays', {
        holidays: validHolidays.map(h => ({
          name: h.name,
          date: h.date,
          country_code: h.country_code || null,
        }))
      });
      
      alert(`${validHolidays.length} holiday(s) created successfully!`);
      // Reset form
      setBulkHolidays([{ name: '', date: '', country_code: '' }]);
      setHolidayError('');
      fetchData();
    } catch (err: any) {
      console.error('Bulk holiday creation error:', err);
      if (err.response?.status === 401) {
        setHolidayError('Session expired. Please login again.');
      } else if (err.response?.status === 403) {
        setHolidayError(err.response?.data?.message || 'You do not have permission to create holidays.');
      } else {
        setHolidayError(err.response?.data?.error || err.response?.data?.message || 'Failed to create holidays');
      }
    } finally {
      setCreatingBulk(false);
    }
  };

  const handleAddBlockedDate = () => {
    setBlockedFormData({ ...blockedFormData, dates: [...blockedFormData.dates, ''] });
  };

  const handleRemoveBlockedDate = (index: number) => {
    if (blockedFormData.dates.length > 1) {
      setBlockedFormData({ ...blockedFormData, dates: blockedFormData.dates.filter((_, i) => i !== index) });
    }
  };

  const handleBlockedDateChange = (index: number, value: string) => {
    const updated = [...blockedFormData.dates];
    updated[index] = value;
    setBlockedFormData({ ...blockedFormData, dates: updated });
  };

  const handleCreateBlockedDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBlocked(true);
    setBlockedError('');

    if (!blockedFormData.employee_id) {
      setBlockedError('Please select an employee');
      setCreatingBlocked(false);
      return;
    }

    // Filter out empty dates
    const validDates = blockedFormData.dates.filter(d => d);
    
    if (validDates.length === 0) {
      setBlockedError('Please add at least one date');
      setCreatingBlocked(false);
      return;
    }

    try {
      // Get employee_id from selected employee
      const selectedEmployee = employees.find(emp => 
        (emp.employee_id || emp.user_id || emp.id)?.toString() === blockedFormData.employee_id
      );
      
      if (!selectedEmployee) {
        setBlockedError('Selected employee not found');
        setCreatingBlocked(false);
        return;
      }

      const employeeId = selectedEmployee.employee_id || selectedEmployee.user_id || selectedEmployee.id;

      await api.post('/Calendar/BlockEmployeeDates', {
        employee_id: employeeId,
        blocked_dates: validDates,
        reason: blockedFormData.reason || null,
      });
      
      alert(`${validDates.length} date(s) blocked successfully!`);
      // Reset form
      setBlockedFormData({
        employee_id: '',
        dates: [''],
        reason: '',
      });
      setBlockedError('');
      fetchData();
    } catch (err: any) {
      console.error('Block date creation error:', err);
      if (err.response?.status === 401) {
        setBlockedError('Session expired. Please login again.');
      } else if (err.response?.status === 403) {
        setBlockedError(err.response?.data?.message || 'You do not have permission to block dates.');
      } else {
        setBlockedError(err.response?.data?.error || err.response?.data?.message || 'Failed to block dates');
      }
    } finally {
      setCreatingBlocked(false);
    }
  };


  // Show loading only on initial load
  const isInitialLoad = loading && holidays.length === 0 && blockedDates.length === 0;

  if (isInitialLoad) {
    return (
      <div className="page-container">
        <PageTitle
          title="Update Leave List"
          breadCrumbItems={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Update Leave List', path: '/dashboard/update-leave-list' }]}
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageTitle
        title="Update Leave List"
        breadCrumbItems={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Update Leave List', path: '/dashboard/update-leave-list' }]}
      />

      {/* Tabs and Location Filter */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex border-b border-gray-200 flex-1">
            <button
              onClick={() => setActiveTab('holidays')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'holidays'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Organization Holidays
            </button>
            <button
              onClick={() => setActiveTab('blocked')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'blocked'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Blocked Dates
            </button>
          </div>
          <div className="ml-4">
            <label htmlFor="location-filter-update" className="form-label text-sm mb-2 mr-2">
              Filter by Location:
            </label>
            <select
              id="location-filter-update"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="form-input w-auto min-w-[120px]"
            >
              <option value="">All</option>
              <option value="IN">IN</option>
              <option value="US">US</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'holidays' ? (
        <>
          {/* Add New Holiday Form Card */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Organization Holidays</h2>
              <button
                onClick={() => router.push('/dashboard/update-leave-list/holidays/create')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Holiday
              </button>
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Add New Holiday</h3>
              
              {/* Form Tabs */}
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => setHolidayFormTab('single')}
                  className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    holidayFormTab === 'single'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Single Holiday
                </button>
                <button
                  onClick={() => setHolidayFormTab('bulk')}
                  className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    holidayFormTab === 'bulk'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Bulk Holiday Entry
                </button>
              </div>

              {holidayFormTab === 'single' ? (
                <form onSubmit={handleCreateHoliday} className="space-y-4">
                  {holidayError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {holidayError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Holiday Name */}
                    <div>
                      <label htmlFor="holiday-name" className="block text-sm font-medium text-gray-700 mb-2">
                        Holiday Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="holiday-name"
                        type="text"
                        value={holidayFormData.name}
                        onChange={(e) => setHolidayFormData({ ...holidayFormData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                        placeholder="e.g., New Year, Christmas"
                      />
                    </div>

                    {/* Holiday Date */}
                    <div>
                      <label htmlFor="holiday-date" className="block text-sm font-medium text-gray-700 mb-2">
                        Holiday Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="holiday-date"
                          type="date"
                          value={holidayFormData.date}
                          onChange={(e) => setHolidayFormData({ ...holidayFormData, date: e.target.value })}
                          required
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                          placeholder="dd-mm-yyyy"
                        />
                        <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Team/Country */}
                    <div>
                      <label htmlFor="holiday-country" className="block text-sm font-medium text-gray-700 mb-2">
                        Team/Country <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="holiday-country"
                        value={holidayFormData.country_code || ''}
                        onChange={(e) => setHolidayFormData({ ...holidayFormData, country_code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                      >
                        <option value="">All Teams (Organization Holiday)</option>
                        <option value="IN">IN (India)</option>
                        <option value="US">US (United States)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">Select which team(s) this holiday applies to</p>
                    </div>

                    {/* Recurring Holiday */}
                    <div className="flex items-center pt-8">
                      <input
                        id="holiday-recurring"
                        type="checkbox"
                        checked={holidayFormData.is_recurring}
                        onChange={(e) => setHolidayFormData({ ...holidayFormData, is_recurring: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="holiday-recurring" className="ml-2 text-sm text-gray-700">
                        Recurring Holiday (every year)
                      </label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setHolidayFormData({ name: '', date: '', country_code: '', is_recurring: false });
                        setHolidayError('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingHoliday}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingHoliday ? 'Creating...' : 'Create Holiday'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreateBulkHolidays} className="space-y-4">
                  {holidayError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {holidayError}
                    </div>
                  )}

                  <div className="space-y-4">
                    {bulkHolidays.map((holiday, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-b border-gray-200 pb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Holiday Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={holiday.name}
                            onChange={(e) => handleBulkHolidayChange(index, 'name', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                            placeholder="e.g., New Year"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Holiday Date <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              value={holiday.date}
                              onChange={(e) => handleBulkHolidayChange(index, 'date', e.target.value)}
                              required
                              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                            />
                            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Team/Country
                          </label>
                          <select
                            value={holiday.country_code || ''}
                            onChange={(e) => handleBulkHolidayChange(index, 'country_code', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                          >
                            <option value="">All Teams</option>
                            <option value="IN">IN (India)</option>
                            <option value="US">US (United States)</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          {bulkHolidays.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBulkRow(index)}
                              className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                          {index === bulkHolidays.length - 1 && (
                            <button
                              type="button"
                              onClick={handleAddBulkRow}
                              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              Add Row
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setBulkHolidays([{ name: '', date: '', country_code: '' }]);
                        setHolidayError('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingBulk}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingBulk ? 'Creating...' : 'Create Holidays'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Holidays Table */}
          <div className="card">
            {holidays.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No organization holidays found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Holiday Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Country / Team</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Status</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((holiday) => {
                      const countryCode = holiday.country_code || '';
                      const countryName = countryCode === 'IN' ? 'India' : countryCode === 'US' ? 'United States' : 'All';
                      const countryBadgeColor = countryCode === 'IN' ? 'bg-orange-100 text-orange-800' : countryCode === 'US' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
                      
                      return (
                        <tr key={holiday.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            {holiday.date ? new Date(holiday.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                          </td>
                          <td className="py-3 px-4">{holiday.name || 'N/A'}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${countryBadgeColor}`}>
                              {countryName}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="badge badge-approved">Active</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => router.push(`/dashboard/update-leave-list/holidays/edit/${holiday.id}`)}
                                className="text-blue-600 hover:text-blue-800 p-2"
                                title="Edit holiday"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteHoliday(holiday.id)}
                                className="text-red-600 hover:text-red-800 p-2"
                                title="Delete holiday"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Add Blocked Date Form Card */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Blocked Dates</h2>
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <form onSubmit={handleCreateBlockedDates} className="space-y-4">
                {blockedError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {blockedError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Employee Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={blockedFormData.employee_id}
                      onChange={(e) => setBlockedFormData({ ...blockedFormData, employee_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                    >
                      <option value="">Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp.employee_id || emp.user_id || emp.id} value={(emp.employee_id || emp.user_id || emp.id)?.toString()}>
                          {emp.full_name || emp.name || 'Unknown'} ({emp.email || 'No email'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={blockedFormData.reason}
                      onChange={(e) => setBlockedFormData({ ...blockedFormData, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                      placeholder="e.g., Training, Conference"
                    />
                  </div>
                </div>

                {/* Blocked Dates List */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blocked Dates <span className="text-red-500">*</span>
                  </label>
                  {blockedFormData.dates.map((date, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <div className="relative">
                          <input
                            type="date"
                            value={date}
                            onChange={(e) => handleBlockedDateChange(index, e.target.value)}
                            required={index === 0}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                          />
                          <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                      {blockedFormData.dates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBlockedDate(index)}
                          className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                      {index === blockedFormData.dates.length - 1 && (
                        <button
                          type="button"
                          onClick={handleAddBlockedDate}
                          className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Add Date
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setBlockedFormData({ employee_id: '', dates: [''], reason: '' });
                      setBlockedError('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingBlocked}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingBlocked ? 'Blocking...' : 'Block Dates'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Blocked Dates Table */}
          <div className="card">
            {blockedDates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No blocked dates found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Reason</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedDates.map((blocked) => (
                    <tr key={blocked.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {blocked.blocked_date || blocked.holiday_date
                          ? new Date(blocked.blocked_date || blocked.holiday_date).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        {blocked.type === 'organization_holiday' 
                          ? 'Organization Holiday' 
                          : (blocked.full_name || blocked.email || `Employee ${blocked.employee_id || 'N/A'}`)}
                      </td>
                      <td className="py-3 px-4">{blocked.reason || blocked.name || 'N/A'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteBlockedDate(blocked)}
                          className="text-red-600 hover:text-red-800 p-2"
                          title="Delete blocked date"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}

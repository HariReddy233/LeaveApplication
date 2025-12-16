'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function CalendarPage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    employee_id: '',
    location: '',
  });
  const [loading, setLoading] = useState(true);
  
  // Filter options
  const [employees, setEmployees] = useState<any[]>([]);
  // Hardcoded locations as per requirement
  const locations = ['India', 'US Miami'];
  const [loadingFilters, setLoadingFilters] = useState(true);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    if (!loadingFilters) {
    fetchCalendarData();
    fetchBlockedDates();
    }
  }, [filters, loadingFilters]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      
      // Check if token exists before making request
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        console.warn('⚠️ No auth token found for calendar data');
        setLeaves([]);
        setLoading(false);
        return;
      }
      
      const params = new URLSearchParams();
      // Only add employee_id filter if a specific employee is selected
      // If no employee is selected, show ALL approved leaves for all users
      if (filters.employee_id) {
        // Check if it's a user_id or employee_id by finding the employee
        const selectedEmp = employees.find((emp: any) => {
          const empId = emp.employee_id || emp.user_id || emp.id;
          return empId.toString() === filters.employee_id.toString();
        });
        if (selectedEmp?.user_id) {
          params.append('user_id', selectedEmp.user_id);
        } else {
          params.append('employee_id', filters.employee_id);
        }
      }
      // Location filter - if selected, filter by location, otherwise show all locations
      if (filters.location) params.append('location', filters.location);
      
      // Note: If no filters are applied, the backend will return ALL approved leaves for all users

      console.log('📅 Fetching calendar data with params:', params.toString());
      
      // Use the correct endpoint that matches backend routes
      const response = await api.get(`/Calendar/CalendarView?${params.toString()}`, {
        headers: { 'X-Skip-Redirect': 'true' }
      });
      
      const leavesData = response.data?.data || response.data || [];
      console.log(`✅ Calendar data fetched: ${leavesData.length} approved leaves`);
      setLeaves(leavesData);
    } catch (err: any) {
      console.error('❌ Failed to fetch calendar data:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      // Set empty state on any error
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedDates = async () => {
    try {
      const response = await api.get('/Calendar/BlockedDates');
      setBlockedDates(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch blocked dates:', error);
      setBlockedDates([]);
      // Don't redirect on error - interceptor handles it for calendar endpoints
    }
  };

  const fetchFilterOptions = async () => {
    try {
      setLoadingFilters(true);
      
      // Check if token exists before making request
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setEmployees([]);
        setLoadingFilters(false);
        return;
      }
      
      // Use UserListForAvailability endpoint - works for all authenticated users (not just admin)
      // This endpoint only requires CheckEmployeeAuth, not CheckAdminAuth
      try {
        const response = await api.get('/User/UserListForAvailability');
        const empList = response.data?.data || response.data?.Data || response.data || [];
        setEmployees(empList);
      } catch (err: any) {
        // Set empty arrays on error
        setEmployees([]);
      }
    } catch (error) {
      setEmployees([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  if (loading || loadingFilters) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Approved Leave Calendar
        </h1>
        <p className="text-gray-600 text-sm" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          View all approved leave dates for all employees. Use filters to narrow down by employee or location.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="employee-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Employee
            </label>
            <select
              id="employee-filter"
              value={filters.employee_id}
              onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm bg-white"
              aria-label="Select employee to filter leave calendar"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => {
                const empId = emp.employee_id || emp.user_id || emp.id;
                const empName = emp.full_name || emp.email || 'Unknown';
                return (
                  <option key={empId} value={empId}>
                    {empName}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <select
              id="location-filter"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm bg-white"
              aria-label="Select location to filter leave calendar"
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Approved Leave Calendar</h2>
          <span className="text-sm text-gray-500">
            {leaves.length} {leaves.length === 1 ? 'approved leave' : 'approved leaves'} found
          </span>
        </div>
        {leaves.length > 0 ? (
          <div className="space-y-3">
            {leaves.map((leave) => {
              const startDate = new Date(leave.start_date);
              const endDate = new Date(leave.end_date);
              const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              
              return (
              <div
                key={leave.id}
                  className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                        {(leave.full_name || leave.email || 'U').charAt(0).toUpperCase()}
                      </div>
                <div>
                        <p className="font-semibold text-gray-900">{leave.full_name || leave.email || 'Unknown'}</p>
                        {leave.email && leave.full_name && (
                          <p className="text-xs text-gray-500">{leave.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="ml-13 mt-2">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Leave Type:</span> {leave.leave_type || 'N/A'}
                      </p>
                      {leave.location && (
                        <p className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">Location:</span> {leave.location}
                        </p>
                      )}
                    </div>
                </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500 mb-1">to</p>
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-blue-600 font-medium">
                      {daysDiff} {daysDiff === 1 ? 'day' : 'days'}
                  </p>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No approved leave records found</p>
            <p className="text-sm text-gray-400 mt-1">
              {filters.employee_id || filters.location 
                ? 'Try adjusting your filters to see more results'
                : 'Approved leaves will appear here once they are approved by both HOD and Admin'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}







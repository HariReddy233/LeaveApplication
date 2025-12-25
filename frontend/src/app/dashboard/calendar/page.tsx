'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function CalendarPage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    employee_id: '',
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateLeaves, setSelectedDateLeaves] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPreviousMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Array<{ date: Date; isCurrentMonth: boolean; leaves: any[] }> = [];
    
    // Previous month's trailing days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, daysInPreviousMonth - i);
      days.push({ date, isCurrentMonth: false, leaves: [] });
    }
    
    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      days.push({ date, isCurrentMonth: true, leaves: [] });
    }
    
    // Next month's leading days to fill the grid (42 cells = 6 weeks)
    const totalCells = 42;
    const remainingCells = totalCells - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(currentYear, currentMonth + 1, day);
      days.push({ date, isCurrentMonth: false, leaves: [] });
    }
    
    return days;
  }, [currentYear, currentMonth, firstDayOfMonth, daysInMonth, daysInPreviousMonth]);

  // Map leaves and blocked dates to calendar days
  const calendarWithLeaves = useMemo(() => {
    return calendarDays.map(day => {
      const dayLeaves = leaves.filter(leave => {
        const startDate = new Date(leave.start_date);
        const endDate = new Date(leave.end_date);
        const dayDate = new Date(day.date);
        
        // Reset time to compare dates only
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        dayDate.setHours(0, 0, 0, 0);
        
        return dayDate >= startDate && dayDate <= endDate;
      });
      
      // Check if this day is blocked (holiday or employee-specific) and get details
      const dayDateStr = day.date.toISOString().split('T')[0];
      let blockedInfo = null;
      const blockedDateMatch = blockedDates.find(blocked => {
        // Handle both organization holidays (holiday_date) and employee blocked dates (blocked_date)
        const blockedDate = blocked.holiday_date || blocked.blocked_date;
        if (!blockedDate) return false;
        const blockedDateStr = new Date(blockedDate).toISOString().split('T')[0];
        return blockedDateStr === dayDateStr;
      });
      
      if (blockedDateMatch) {
        blockedInfo = {
          type: blockedDateMatch.type || 'blocked',
          reason: blockedDateMatch.reason || blockedDateMatch.holiday_name || 'Blocked Date',
          isHoliday: blockedDateMatch.type === 'organization_holiday'
        };
      }
      
      const isBlocked = !!blockedInfo;
      
      // Check if weekend
      const dayOfWeek = day.date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      return { ...day, leaves: dayLeaves, isBlocked, isWeekend, blockedInfo };
    });
  }, [calendarDays, leaves, blockedDates]);

  // Fetch functions
  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setLeaves([]);
        setLoading(false);
        return;
      }
      
      // Calculate start and end dates for the current month view
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const params = new URLSearchParams();
      params.append('start_date', startDate.toISOString().split('T')[0]);
      params.append('end_date', endDate.toISOString().split('T')[0]);
      
      if (filters.employee_id) {
        // Fetch employees if needed (they should already be loaded by fetchFilterOptions)
        const currentEmployees = employees.length > 0 ? employees : [];
        const selectedEmp = currentEmployees.find((emp: any) => {
          const empId = emp.employee_id || emp.user_id || emp.id;
          return empId.toString() === filters.employee_id.toString();
        });
        if (selectedEmp?.user_id) {
          params.append('user_id', selectedEmp.user_id);
        } else {
          params.append('employee_id', filters.employee_id);
        }
      }
      
      const [leavesResponse, blockedDatesResponse] = await Promise.all([
        api.get(`/Calendar/CalendarView?${params.toString()}`, {
          headers: { 'X-Skip-Redirect': 'true' }
        }),
        api.get(`/Calendar/AllBlockedDates?${params.toString()}`, {
          headers: { 'X-Skip-Redirect': 'true' }
        }).catch(() => ({ data: { data: [] } })) // Silently fail if no permission
      ]);
      
      const response = leavesResponse;
      
      const leavesData = response.data?.data || response.data || [];
      setLeaves(leavesData);
      
      // Set blocked dates (organization holidays + employee-specific)
      if (blockedDatesResponse?.data?.data) {
        setBlockedDates(blockedDatesResponse.data.data);
      } else {
        setBlockedDates([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch calendar data:', err);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      setLoadingFilters(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setEmployees([]);
        setLoadingFilters(false);
        return;
      }
      
      try {
        const response = await api.get('/User/UserListForAvailability');
        const empList = response.data?.data || response.data?.Data || response.data || [];
        setEmployees(empList);
      } catch (err: any) {
        setEmployees([]);
      }
    } catch (error) {
      setEmployees([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await api.get('/Auth/Me');
        if (response.data?.user?.role) {
          setUserRole(response.data.user.role.toLowerCase());
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      }
    };
    fetchUserRole();
  }, []);

  // useEffect hooks - must be after function definitions but BEFORE any conditional returns
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    if (!loadingFilters) {
      fetchCalendarData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, loadingFilters, currentDate, employees]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Loading state - must be AFTER all hooks
  if (loading || loadingFilters) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  // Main calendar view
  return (
    <div className="page-container space-y-6">
      {/* Compact Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="w-full max-w-xs">
            <label htmlFor="employee-filter" className="form-label text-sm mb-2">
              Filter by Employee
            </label>
            <select
              id="employee-filter"
              value={filters.employee_id}
              onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
              className="form-input"
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
        </div>
      </div>

      {/* Calendar Grid - Zoho Style */}
      <div className="card p-4">
        {/* Month Navigation - Zoho Style */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous month"
              title="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next month"
              title="Next month"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-2"
            >
              Today
            </button>
          </div>
          
          {/* Month Selector Dropdown */}
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <select
              value={`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-');
                setCurrentDate(new Date(parseInt(year), parseInt(month) - 1, 1));
              }}
              className="form-input w-auto min-w-[180px]"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() + (i - 12)); // Show 12 months before and after
                const month = date.getMonth();
                const year = date.getFullYear();
                return (
                  <option key={`${year}-${String(month + 1).padStart(2, '0')}`} value={`${year}-${String(month + 1).padStart(2, '0')}`}>
                    {monthNames[month]} {year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Calendar Grid - Zoho Style */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {/* Day Headers */}
            {dayNames.map(day => (
              <div key={day} className="p-2.5 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarWithLeaves.map((day, index) => {
              const isToday = day.date.toDateString() === new Date().toDateString();
              const isBlocked = day.isBlocked || false;
              const isWeekend = day.isWeekend || false;
              const blockedInfo = day.blockedInfo;
              const uniqueLeaves = day.leaves.filter((leave, idx, self) => 
                idx === self.findIndex(l => l.id === leave.id)
              );
              
              // Build tooltip text for blocked dates
              let tooltipText = '';
              if (isBlocked && blockedInfo) {
                if (blockedInfo.isHoliday) {
                  tooltipText = `Organization Holiday: ${blockedInfo.reason}`;
                } else {
                  tooltipText = `Blocked Date: ${blockedInfo.reason || 'No reason provided'}`;
                }
              } else if (isWeekend) {
                tooltipText = 'Weekend';
              }
              
              return (
                <div
                  key={index}
                  className={`relative min-h-[90px] p-1.5 border-r border-b border-gray-200 last:border-r-0 ${
                    !day.isCurrentMonth ? 'bg-gray-50' : 
                    isBlocked ? 'bg-red-50' : 
                    isWeekend ? 'bg-gray-100' :
                    'bg-white'
                  } ${isToday ? 'ring-2 ring-blue-500' : ''} ${!isBlocked ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-75'} transition-colors`}
                  title={tooltipText}
                >
                  <div className={`text-sm font-medium mb-1.5 ${
                    !day.isCurrentMonth ? 'text-gray-400' : 
                    isBlocked ? 'text-red-700 font-semibold' :
                    isWeekend ? 'text-gray-500' :
                    isToday ? 'text-blue-600 font-bold' : 'text-gray-900'
                  }`}>
                    {day.date.getDate()}
                    {isToday && !isBlocked && (
                      <span className="ml-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full inline-block"></span>
                    )}
                    {isBlocked && blockedInfo && (
                      <span className="ml-1 text-xs text-red-600" title={blockedInfo.isHoliday ? `Holiday: ${blockedInfo.reason}` : `Blocked: ${blockedInfo.reason}`}>
                        {blockedInfo.isHoliday ? '🎉' : '🚫'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {uniqueLeaves.slice(0, 2).map((leave) => {
                      const startDate = new Date(leave.start_date);
                      const endDate = new Date(leave.end_date);
                      const isStart = day.date.toDateString() === startDate.toDateString();
                      const isEnd = day.date.toDateString() === endDate.toDateString();
                      const isRange = !isStart && !isEnd;
                      const employeeName = (leave.full_name || leave.email || 'Unknown').split(' ')[0];
                      
                      // Format dates for tooltip
                      const fromDate = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                      const toDate = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                      const daysCount = leave.number_of_days || Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const tooltipText = `${leave.full_name || leave.email || 'Unknown'}\nLeave Type: ${leave.leave_type || 'N/A'}\nFrom: ${fromDate}\nTo: ${toDate}\nDuration: ${daysCount} day${daysCount !== 1 ? 's' : ''}${leave.reason ? `\nReason: ${leave.reason}` : ''}`;
                      
                      return (
                        <div
                          key={leave.id}
                          className={`text-xs px-2 py-1 rounded cursor-pointer transition-all hover:shadow-sm truncate ${
                            isStart || isEnd
                              ? 'bg-blue-600 text-white font-medium'
                              : isRange
                              ? 'bg-blue-100 text-blue-800 border-l-2 border-blue-600'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                          title={tooltipText}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setSelectedDateLeaves(uniqueLeaves);
                            setShowModal(true);
                          }}
                        >
                          {employeeName}
                        </div>
                      );
                    })}
                    {uniqueLeaves.length > 2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(day.date);
                          setSelectedDateLeaves(uniqueLeaves);
                          setShowModal(true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 font-medium cursor-pointer hover:underline w-full text-left"
                      >
                        +{uniqueLeaves.length - 2} more
                      </button>
                    )}
                  </div>
                  {/* Clickable date cell for modal */}
                  {uniqueLeaves.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedDate(day.date);
                        setSelectedDateLeaves(uniqueLeaves);
                        setShowModal(true);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      aria-label={`View ${uniqueLeaves.length} leave(s) on ${day.date.toLocaleDateString()}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leave Details Modal */}
      {showModal && selectedDate && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            width: '100vw', 
            height: '100vh',
            margin: 0,
            padding: '1rem'
          }}
          onClick={() => {
            setShowModal(false);
            setSelectedDate(null);
            setSelectedDateLeaves([]);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '42rem', width: '100%' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Leaves on {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedDateLeaves.length} leave{selectedDateLeaves.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedDate(null);
                  setSelectedDateLeaves([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {selectedDateLeaves.map((leave) => {
                  const startDate = new Date(leave.start_date);
                  const endDate = new Date(leave.end_date);
                  const fromDate = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                  const toDate = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                  const daysCount = leave.number_of_days || Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  // Determine status with actual approver names
                  // Determine status - For Admin, only show admin_status
                  let status = '';
                  const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole')?.toLowerCase() : '';
                  const isAdmin = userRole === 'admin';
                  
                  if (isAdmin) {
                    // Admin view: Only show admin status
                    if (leave.admin_status === 'Approved') {
                      const approverName = leave.admin_approver_name || 'Admin';
                      status = `Approved by ${approverName}`;
                    } else if (leave.admin_status === 'Rejected') {
                      status = 'Rejected';
                    } else {
                      status = 'Pending';
                    }
                  } else {
                    // HOD/Employee view: Show combined status
                    if (leave.hod_status === 'Approved' && leave.admin_status === 'Approved') {
                      status = 'Fully Approved';
                    } else if (leave.hod_status === 'Approved') {
                      const approverName = leave.hod_approver_name || 'HOD';
                      status = `Approved by ${approverName}`;
                    } else if (leave.admin_status === 'Approved') {
                      const approverName = leave.admin_approver_name || 'Admin';
                      status = `Approved by ${approverName}`;
                    } else {
                      status = 'Pending';
                    }
                  }

                  return (
                    <div key={leave.id} className="card p-5 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-1">{leave.full_name || leave.email || 'Unknown'}</h3>
                          <p className="text-sm text-gray-600">{leave.email}</p>
                        </div>
                        <span className={`badge ${
                          status === 'Fully Approved' 
                            ? 'badge-approved' 
                            : 'badge-pending'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <span className="text-gray-600">Leave Type:</span>
                          <span className="ml-2 font-medium text-gray-900">{leave.leave_type || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Duration:</span>
                          <span className="ml-2 font-medium text-gray-900">{daysCount} day{daysCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">From:</span>
                          <span className="ml-2 font-medium text-gray-900">{fromDate}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">To:</span>
                          <span className="ml-2 font-medium text-gray-900">{toDate}</span>
                        </div>
                      </div>
                      {leave.reason && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className="text-gray-600 text-sm font-medium">Reason:</span>
                          <p className="text-sm text-gray-900 mt-1.5">{leave.reason}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

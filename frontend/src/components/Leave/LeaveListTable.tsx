'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactPaginate from 'react-paginate';
import { Edit, Trash2, FileText, FileSpreadsheet } from 'lucide-react';
import api from '@/lib/api';
import DateFormatter from '@/utils/DateFormatter';
import ExportDataJSON from '@/utils/ExportFromJSON';
import classNames from 'classnames';
import { useSSE } from '@/hooks/useSSE';

type LeaveListTableProps = {
  endpoint: string;
  title: string;
  breadCrumbItems: Array<{ label: string; path: string; active?: boolean }>;
  showActions?: boolean;
  canEdit?: (record: any) => boolean;
  canDelete?: (record: any) => boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  status?: string; // For status filtering (Pending, Approved, Rejected)
  method?: 'GET' | 'POST'; // Request method
};

/**
 * Reusable Leave List Table Component - Matches HR Portal
 */
export default function LeaveListTable({
  endpoint,
  title,
  breadCrumbItems,
  showActions = true,
  canEdit = (record) => {
    // Admin can edit any leave, employees can only edit pending leaves
    const isAdmin = endpoint.includes('Admin') || endpoint.includes('admin');
    if (isAdmin) return true;
    return record.HodStatus === 'Pending' || record.hod_status === 'Pending';
  },
  canDelete,
  onApprove,
  onReject,
  status,
  method = 'GET',
}: LeaveListTableProps) {
  const router = useRouter();
  const [pageNumber, setPageNumber] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>(status || 'All');
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [allLeaves, setAllLeaves] = useState<any[]>([]);
  const [totalLeave, setTotalLeave] = useState(0);
  const [loading, setLoading] = useState(true);

  // Default canDelete function - Admin can delete any leave, others only pending
  const defaultCanDelete = (record: any) => {
    // Admin can delete any leave (approved, rejected, pending)
    // Other users (HOD, employees) can only delete pending leaves
    const isAdmin = userRole?.toLowerCase() === 'admin';
    if (isAdmin) return true;
    
    // For non-admin users, only allow deletion of pending leaves
    const hodStatus = (record.HodStatus || record.hod_status || 'Pending').toString().trim().toLowerCase();
    const adminStatus = (record.AdminStatus || record.admin_status || 'Pending').toString().trim().toLowerCase();
    return hodStatus === 'pending' && adminStatus === 'pending';
  };
  
  // Use provided canDelete or default
  const checkCanDelete = canDelete || defaultCanDelete;

  // Real-time updates via SSE
  useSSE({
    onNewLeave: () => {
      // Refresh leaves list when new leave is created
      if (currentUser && userRole) {
        fetchLeaves();
      }
    },
    onLeaveStatusUpdate: () => {
      // Refresh leaves list when leave status is updated
      if (currentUser && userRole) {
        fetchLeaves();
      }
    },
    onLeaveDeleted: () => {
      // Refresh leaves list when leave is deleted
      if (currentUser && userRole) {
        fetchLeaves();
      }
    },
    enabled: true
  });

  // Fetch current user first, then fetch users based on role
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Fetch users after current user and role are loaded
  useEffect(() => {
    if (currentUser && userRole) {
      fetchUsers();
    }
  }, [currentUser, userRole]);

  // Set default user after currentUser is loaded
  // For Admin/HOD: Keep selectedUserId empty (shows "All Users")
  // For Employees: Set to current user's ID
  useEffect(() => {
    if (currentUser && !selectedUserId) {
      const role = userRole?.toLowerCase();
      const isAdminOrHod = role === 'admin' || role === 'hod';
      
      // Only set to current user for regular employees
      // Admin and HOD should start with "All Users" (empty selectedUserId)
      if (!isAdminOrHod) {
        const userId = currentUser.id || currentUser.user_id || currentUser._id;
        if (userId) {
          console.log('👤 Setting default user to:', userId);
          setSelectedUserId(userId.toString());
        }
      } else {
        console.log('👤 Admin/HOD - keeping selectedUserId empty for "All Users" view');
      }
    }
  }, [currentUser, selectedUserId, userRole]);

  // Fetch leaves when filters change (only after current user is loaded)
  useEffect(() => {
    // Don't fetch until we have current user
    // selectedUserId can be empty for "All Users" option (admin/HOD only)
    if (currentUser && userRole) {
      fetchLeaves();
    }
  }, [pageNumber, perPage, selectedUserId, endpoint, currentUser, userRole]);

  // Filter leaves by status when status changes
  useEffect(() => {
    filterLeavesByStatus();
  }, [selectedStatus, allLeaves, pageNumber, perPage]);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/Auth/Me');
      console.log('✅ /Auth/Me response:', response.data);
      if (response.data && response.data.user) {
        const user = response.data.user;
        console.log('👤 Current user:', user);
        setCurrentUser(user);
        const role = user.role || 'employee';
        console.log('🎭 Setting user role to:', role);
        setUserRole(role);
        // Don't set selectedUserId here - let the useEffect handle it based on role
        // Admin/HOD should start with empty (All Users), Employees start with their own ID
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch current user:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('🔍 fetchUsers called - userRole:', userRole, 'currentUser:', currentUser);
      
      // Try to fetch users based on role, but allow all users to see the list for availability checking
      const role = userRole?.toLowerCase()?.trim();
      
      // Try admin endpoint first (for admins)
      if (role === 'admin') {
        console.log('👤 User is Admin - fetching all employees');
        try {
          const response = await api.get('/User/EmployeeList');
          console.log('✅ Admin EmployeeList response:', response.data);
          const userList = response.data?.data || response.data?.Data || response.data || [];
          console.log('📋 Parsed user list:', userList);
          if (Array.isArray(userList) && userList.length > 0) {
            setUsers(userList);
            return;
          }
        } catch (err: any) {
          console.warn('⚠️ Admin endpoint failed, trying alternatives:', err.response?.status);
        }
      }
      
      // Try HOD endpoint (for HODs)
      if (role === 'hod') {
        console.log('👤 User is HOD - fetching HOD employees');
        try {
          const response = await api.get('/User/EmployeeListHod');
          console.log('✅ HOD EmployeeListHod response:', response.data);
          const userList = response.data?.data || response.data?.Data || response.data || [];
          console.log('📋 Parsed user list:', userList);
          if (Array.isArray(userList) && userList.length > 0) {
            setUsers(userList);
            return;
          }
        } catch (err: any) {
          console.warn('⚠️ HOD endpoint failed, trying alternatives:', err.response?.status);
        }
      }
      
      // For all users (including employees), try to fetch user list for availability checking
      console.log('👤 Attempting to fetch user list for availability checking');
      try {
        // Use the new endpoint that all authenticated users can access
        const response = await api.get('/User/UserListForAvailability');
        console.log('✅ UserListForAvailability response:', response.data);
        const userList = response.data?.data || response.data?.Data || response.data || [];
        console.log('📋 Parsed user list:', userList);
        if (Array.isArray(userList) && userList.length > 0) {
          setUsers(userList);
          return;
        }
      } catch (err: any) {
        console.warn('⚠️ UserListForAvailability endpoint failed, trying fallback:', err.response?.status);
        // Fallback: try admin endpoint (might work if user has permissions)
        try {
          const response = await api.get('/User/EmployeeList');
          const userList = response.data?.data || response.data?.Data || response.data || [];
          if (Array.isArray(userList) && userList.length > 0) {
            setUsers(userList);
            return;
          }
        } catch (fallbackErr: any) {
          console.warn('⚠️ Fallback endpoint also failed, using current user only');
        }
        // If all endpoints fail, fallback to current user only
        if (currentUser) {
          const userId = currentUser.id || currentUser.user_id;
          const userName = currentUser.full_name || currentUser.email || 'Current User';
          setUsers([{ user_id: userId, id: userId, full_name: userName, email: currentUser.email }]);
        }
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch users:', err);
      // Fallback to current user only
      if (currentUser) {
        const userId = currentUser.id || currentUser.user_id;
        const userName = currentUser.full_name || currentUser.email || 'Current User';
        setUsers([{ user_id: userId, id: userId, full_name: userName, email: currentUser.email }]);
      } else {
        setUsers([]);
      }
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      console.log('🔄 fetchLeaves called:', { 
        selectedUserId, 
        status, 
        endpoint, 
        method,
        pageNumber,
        perPage,
        searchKey
      });
      
      // Don't fetch if current user is not loaded yet
      if (!currentUser) {
        console.log('⏳ Waiting for current user...');
        setLoading(false);
        return;
      }
      
      // Determine which endpoint to use based on user role and selection
      let actualEndpoint = endpoint;
      const isAdmin = userRole?.toLowerCase() === 'admin';
      const isHod = userRole?.toLowerCase() === 'hod';
      const currentUserId = currentUser ? (currentUser.id || currentUser.user_id)?.toString() : '';
      const isCurrentUser = selectedUserId && currentUserId && selectedUserId === currentUserId;
      
      // For Admin: Empty selectedUserId or "all" means "All Users" -> use Admin endpoint
      // For HOD: Empty selectedUserId or "all" means "All Users" -> use HOD endpoint
      // For Employee: Empty means their own leaves -> use regular endpoint
      if (!selectedUserId || selectedUserId === '' || selectedUserId === 'all' || selectedUserId === 'All Users') {
        if (isAdmin) {
          actualEndpoint = '/Leave/LeaveAdminList';
        } else if (isHod) {
          actualEndpoint = '/Leave/LeaveListHod';
        } else {
          // Regular employee - can only see their own
          actualEndpoint = '/Leave/LeaveList';
        }
      } else if (isCurrentUser) {
        // Current user is selected, use the regular endpoint
        actualEndpoint = '/Leave/LeaveList';
      } else {
        // Different user selected - need admin/HOD endpoint to get all leaves
        if (isAdmin) {
          actualEndpoint = '/Leave/LeaveAdminList';
        } else if (isHod) {
          actualEndpoint = '/Leave/LeaveListHod';
        } else {
          // Regular employee trying to view another user - fallback to their own
          actualEndpoint = '/Leave/LeaveList';
        }
      }
      
      let response;
      // For Admin, pass userId as query parameter if a specific user is selected
      const isAdminEndpoint = actualEndpoint.includes('Admin') || actualEndpoint.includes('admin');
      const userIdParam = (isAdminEndpoint && selectedUserId && selectedUserId !== 'all' && selectedUserId !== 'All Users' && selectedUserId !== '') 
        ? `?userId=${selectedUserId}` 
        : '';
      
      if (method === 'POST') {
        // POST request for status filtering
        const url = `${actualEndpoint}/${pageNumber}/${perPage}/0${userIdParam}`;
        response = await api.post(url, { status });
      } else {
        // GET request - fetch all leaves (no search, no pagination limit for filtering)
        const url = actualEndpoint.includes('?') 
          ? `${actualEndpoint}&pageNumber=1&perPage=1000&searchKeyword=0${userIdParam ? '&' + userIdParam.substring(1) : ''}`
          : `${actualEndpoint}/1/1000/0${userIdParam}`;
        response = await api.get(url);
      }
      
      if (response.data) {
        let data = response.data.Data || response.data.data || [];
        const total = response.data.Total?.[0]?.count || response.data.total || 0;
        
        console.log(`📊 Fetched ${data.length} leaves from API (total: ${total})`);
        
        // For Admin endpoint, backend already filters by userId, so no client-side filtering needed
        // Only apply client-side filtering if NOT using Admin endpoint (for backward compatibility)
        if (!isAdminEndpoint && selectedUserId && selectedUserId !== 'all' && selectedUserId !== 'All Users') {
          // Find the selected user to get their email and user_id
          const selectedUser = users.find(u => {
            const uId = (u.user_id || u.id)?.toString();
            return uId === selectedUserId.toString();
          });
          
          if (selectedUser) {
            const selectedEmail = (selectedUser.email || selectedUser.Email)?.toLowerCase();
            const selectedUserIdValue = (selectedUser.user_id || selectedUser.id)?.toString();
            const selectedEmployeeId = selectedUser.employee_id || selectedUser.employeeId || selectedUser.EmployeeId;
            const beforeFilter = data.length;
            
            console.log('🔍 Filtering by user (client-side):', {
              selectedUserId: selectedUserIdValue,
              selectedEmail,
              selectedEmployeeId,
              selectedUser
            });
            
            data = data.filter((record: any) => {
              // Method 1: Match by user_id from the record (most reliable)
              const recordUserId = record.user_id || record.userId || record.UserId;
              if (recordUserId && selectedUserIdValue) {
                const matches = recordUserId.toString() === selectedUserIdValue.toString();
                if (matches) {
                  return true;
                }
              }
              
              // Method 2: Match by employee_id if available
              const recordEmployeeId = record.employee_id || record.employeeId || record.EmployeeId;
              if (selectedEmployeeId && recordEmployeeId) {
                const matches = recordEmployeeId.toString() === selectedEmployeeId.toString();
                if (matches) {
                  return true;
                }
              }
              
              // Method 3: Match by email from Employee array
              const employee = record.Employee?.[0] || record.employee || {};
              const recordEmail = (employee.Email || employee.email || record.email || record.Email)?.toLowerCase()?.trim();
              if (recordEmail && selectedEmail) {
                const matches = recordEmail === selectedEmail;
                if (matches) {
                  return true;
                }
              }
              
              // Method 4: Match by full_name (fallback)
              const recordFullName = record.full_name || (employee.FirstName && employee.LastName ? `${employee.FirstName} ${employee.LastName}` : null);
              const selectedFullName = selectedUser.full_name;
              if (recordFullName && selectedFullName) {
                const matches = recordFullName.toLowerCase().trim() === selectedFullName.toLowerCase().trim();
                if (matches) {
                  return true;
                }
              }
              
              return false;
            });
            
            console.log(`👤 User filter "${selectedUser.full_name || selectedUser.email}": ${beforeFilter} → ${data.length} records`);
          } else {
            console.warn(`⚠️ Selected user not found in users list: ${selectedUserId}`);
            console.warn('Available users:', users.map(u => ({ id: u.user_id || u.id, name: u.full_name || u.email })));
          }
        }
        
        // Store all leaves for client-side filtering
        setAllLeaves(data);
        
        // Apply initial filtering
        filterLeavesByStatus();
      }
    } catch (err: any) {
      console.error('Failed to fetch leaves:', err);
      
      // If user doesn't have permission to view other users' leaves, fallback to their own
      if (err.response?.status === 403 && selectedUserId && currentUser && 
          selectedUserId !== (currentUser.id || currentUser.user_id)?.toString()) {
        console.log('Permission denied, falling back to current user\'s leaves');
        // Reset to current user
        const userId = currentUser.id || currentUser.user_id;
        if (userId) {
          setSelectedUserId(userId.toString());
        }
      } else if (err.response?.status === 403 && (!selectedUserId || selectedUserId === '')) {
        // If trying to view all users but no permission, fallback to current user
        console.log('Permission denied for all users, falling back to current user\'s leaves');
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) {
          setSelectedUserId(userId.toString());
        }
      } else if (err.response?.status === 401) {
        // Authentication error - token might be expired
        console.error('Authentication error - token expired or invalid');
        // Don't set leaves to empty, let the API interceptor handle the redirect
      }
      
      if (err.response?.status !== 401) {
        setLeaves([]);
        setTotalLeave(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const filterLeavesByStatus = () => {
    if (allLeaves.length === 0) {
      setLeaves([]);
      setTotalLeave(0);
      return;
    }

    let filtered = allLeaves;
    
    if (selectedStatus !== 'All') {
      filtered = allLeaves.filter((record: any) => {
        const hodStatus = (record.HodStatus || record.hod_status || 'Pending').toString().trim();
        const adminStatus = (record.AdminStatus || record.admin_status || 'Pending').toString().trim();
        const finalStatus = (record.status || record.Status || record.final_status || '').toString().trim().toLowerCase();

        if (selectedStatus === 'Approved') {
          if (finalStatus === 'approved') return true;
          // Show if both HOD and Admin approved, or if at least one approved (for partial approvals)
          return (hodStatus.toLowerCase() === 'approved' || adminStatus.toLowerCase() === 'approved') 
            && hodStatus.toLowerCase() !== 'rejected' 
            && adminStatus.toLowerCase() !== 'rejected';
        } else if (selectedStatus === 'Rejected') {
          if (finalStatus === 'rejected') return true;
          // Show if either HOD or Admin rejected
          return hodStatus.toLowerCase() === 'rejected' || adminStatus.toLowerCase() === 'rejected';
        } else if (selectedStatus === 'Pending') {
          if (finalStatus === 'pending') return true;
          // Show if either HOD or Admin is still pending (and not rejected)
          return (hodStatus.toLowerCase() === 'pending' || adminStatus.toLowerCase() === 'pending')
            && hodStatus.toLowerCase() !== 'rejected'
            && adminStatus.toLowerCase() !== 'rejected';
        }
        return false;
      });
    }

    // Apply pagination
    const paginatedLeaves = filtered.slice((pageNumber - 1) * perPage, pageNumber * perPage);
    setLeaves(paginatedLeaves);
    setTotalLeave(filtered.length);
  };

  const PerPageOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'All') {
      setPerPage(totalLeave);
    } else {
      setPerPage(parseInt(e.target.value));
    }
    setPageNumber(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
    setPageNumber(1);
  };

  const HandlePageClick = (e: { selected: number }) => {
    setPageNumber(e.selected + 1);
  };

  const GoToPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= Math.ceil(totalLeave / perPage)) {
      setPageNumber(page);
    }
  };

  const DeleteLeave = async (id: number) => {
    if (!confirm('Are you sure you want to delete this leave application?')) {
      return;
    }
    try {
      await api.delete(`/Leave/LeaveDelete/${id}`);
      fetchLeaves();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete leave');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link>
            {breadCrumbItems.map((item, index) => (
              <span key={index} className="flex items-center">
                <span className="mx-2">/</span>
                {item.active ? (
                  <span className="text-gray-900 font-medium">{item.label}</span>
                ) : (
                  <Link href={item.path} className="hover:text-gray-900">{item.label}</Link>
                )}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <h4 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {title} {totalLeave}
          </h4>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4">
          {/* Action Buttons */}
          <div className="flex justify-end mb-3">
            <div className="flex gap-2">
              <button
                onClick={() => ExportDataJSON(leaves, 'Leave', 'xls')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center gap-2"
                aria-label="Export leave data to Excel"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export
              </button>
              <button
                onClick={() => ExportDataJSON(leaves, 'Leave', 'csv')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center gap-2"
                aria-label="Export leave data to CSV"
              >
                <FileText className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>

          {/* User Filter and Status Filter */}
          <div className="mb-4 flex items-center gap-4 flex-wrap">
            {(userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'hod') && (
              <div className="flex items-center gap-2">
                <label htmlFor="user-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">User:</label>
                <select
                  id="user-select"
                  value={selectedUserId}
                  onChange={(e) => {
                    console.log('🔄 User selected:', e.target.value);
                    setSelectedUserId(e.target.value);
                    setPageNumber(1);
                  }}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  aria-label="Select user to filter leave applications"
                >
                  <option value="">All Users</option>
                  {users.length > 0 ? (
                    users.map((user) => {
                      const userId = user.user_id || user.id;
                      const userName = user.full_name || user.email || 'Unknown User';
                      return (
                        <option key={userId} value={userId}>
                          {userName}
                        </option>
                      );
                    })
                  ) : (
                    <option value="">Loading users...</option>
                  )}
                </select>
                {users.length > 0 && (
                  <span className="ml-2 text-xs text-gray-500">({users.length} users)</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="status-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">Status:</label>
              <select
                id="status-select"
                value={selectedStatus}
                onChange={handleStatusChange}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors min-w-[140px]"
                aria-label="Filter by status"
              >
                <option value="All">All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead style={{ backgroundColor: '#eef2f7' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Leave Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Application Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Total Day</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Hod Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Admin Status</th>
                  {showActions && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {leaves.length > 0 ? (
                  leaves.map((record: any, index: number) => {
                    const employee = record.Employee?.[0] || {};
                    const firstName = employee.FirstName || '';
                    const lastName = employee.LastName || '';
                    const fullName = `${firstName} ${lastName}`.trim() || record.full_name || 'N/A';
                    const email = employee.Email || record.email || '';
                    
                    return (
                      <tr key={record.id || record._id || index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium text-xs">
                              {fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{fullName}</div>
                              <div className="text-xs text-gray-500">{email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.LeaveType || record.leave_type || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <DateFormatter date={record.createdAt || record.created_at} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.NumOfDay || record.number_of_days || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={classNames('px-2.5 py-1 rounded-full text-xs font-medium', {
                                'bg-green-100 text-green-800': (record.HodStatus || record.hod_status) === 'Approved',
                                'bg-yellow-100 text-yellow-800': (record.HodStatus || record.hod_status) === 'Pending',
                                'bg-red-100 text-red-800': (record.HodStatus || record.hod_status) === 'Rejected',
                              })}
                            >
                              {record.HodStatus || record.hod_status || 'Pending'}
                            </span>
                            {(record.HodApproverName || record.hod_approver_name) && (record.HodStatus || record.hod_status) === 'Approved' && (
                              <span className="text-xs text-gray-500">by {record.HodApproverName || record.hod_approver_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={classNames('px-2.5 py-1 rounded-full text-xs font-medium', {
                                'bg-green-100 text-green-800': (record.AdminStatus || record.admin_status) === 'Approved',
                                'bg-yellow-100 text-yellow-800': (record.AdminStatus || record.admin_status) === 'Pending',
                                'bg-red-100 text-red-800': (record.AdminStatus || record.admin_status) === 'Rejected',
                              })}
                            >
                              {record.AdminStatus || record.admin_status || 'Pending'}
                            </span>
                            {(record.AdminApproverName || record.admin_approver_name) && (record.AdminStatus || record.admin_status) === 'Approved' && (
                              <span className="text-xs text-gray-500">by {record.AdminApproverName || record.admin_approver_name}</span>
                            )}
                          </div>
                        </td>
                        {showActions && (
                          <td className="px-4 py-3">
                            {canEdit(record) && (
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/dashboard/apply-leave?id=${record.id || record._id}`}
                                  className="text-yellow-600 hover:text-yellow-800"
                                  title="Edit"
                                  aria-label="Edit leave application"
                                >
                                  <Edit className="w-4 h-4" />
                                </Link>
                                {checkCanDelete(record) && (
                                  <button
                                    onClick={() => DeleteLeave(record.id || record._id)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Delete"
                                    aria-label="Delete leave application"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                            {!canEdit(record) && <span className="text-gray-400 text-xs">-</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={showActions ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                      No leave applications found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="per-page-select" className="text-sm text-gray-700">Display :</label>
              <select
                id="per-page-select"
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                value={perPage === totalLeave ? 'All' : perPage}
                onChange={PerPageOnChange}
                aria-label="Select number of records to display per page"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value="All">All</option>
              </select>
            </div>
            <span className="text-sm text-gray-700">
              Page <strong>{pageNumber} of {Math.ceil(totalLeave / perPage) || 1}</strong>
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="go-to-page-input" className="text-sm text-gray-700">Go to page :</label>
              <input
                id="go-to-page-input"
                type="number"
                min={1}
                max={Math.ceil(totalLeave / perPage) || 1}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                defaultValue={1}
                onChange={GoToPage}
                aria-label="Go to specific page number"
                placeholder="1"
              />
            </div>
            <nav aria-label="Pagination navigation">
            <ReactPaginate
                previousLabel={<span aria-label="Go to previous page">&lt;</span>}
                nextLabel={<span aria-label="Go to next page">&gt;</span>}
              pageCount={Math.ceil(totalLeave / perPage) || 1}
              marginPagesDisplayed={2}
              pageRangeDisplayed={5}
              onPageChange={HandlePageClick}
              forcePage={pageNumber - 1}
              containerClassName="flex items-center gap-1"
              pageClassName="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100"
              pageLinkClassName="text-gray-700"
              previousClassName="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100"
              previousLinkClassName="text-gray-700"
              nextClassName="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100"
              nextLinkClassName="text-gray-700"
              breakClassName="px-2 py-1"
              breakLabel="..."
              activeClassName="bg-blue-600 text-white border-blue-600"
              activeLinkClassName="text-white"
              disabledClassName="opacity-50 cursor-not-allowed"
            />
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}


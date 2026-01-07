'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params?.id as string;
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'employee',
    location: '',
    department: '',
    designation: '',
    hod_id: '', // HOD assignment (manager_id) - for Employees
    admin_id: '', // Admin assignment (admin_id) - for HODs
    phone_number: '',
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [hods, setHods] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [hodsError, setHodsError] = useState('');
  const [hodsLoading, setHodsLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdminEditingSelf, setIsAdminEditingSelf] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (employeeId) {
      fetchEmployee();
      fetchDepartments();
      // Only fetch HODs/Admins if user is admin and not editing self
      // HODs don't need HODs/Admins lists for editing employees
      if (isAdmin && !isAdminEditingSelf) {
        fetchHods();
        fetchAdmins();
      }
    }
  }, [employeeId, isAdminEditingSelf, isAdmin]);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/Auth/Me');
      if (response.data && response.data.user) {
        const user = response.data.user;
        setCurrentUser(user);
        // Check if current user is admin
        const userIsAdmin = (user.role || '').toLowerCase() === 'admin';
        setIsAdmin(userIsAdmin);
        // Check if current user is admin and editing their own profile
        const userId = user.id || user.user_id;
        const isEditingSelf = userId?.toString() === employeeId;
        setIsAdminEditingSelf(userIsAdmin && isEditingSelf);
      }
    } catch (err: any) {
      console.error('Failed to fetch current user:', err);
    }
  };

  // Refetch HODs if they failed to load initially
  useEffect(() => {
    if (hods.length === 0 && !hodsLoading && !hodsError) {
      fetchHods();
    }
  }, []);

  // Update HOD selection when HODs are loaded and we have a manager_id
  useEffect(() => {
    if (hods.length > 0 && formData.hod_id) {
      // Try to match the current hod_id with the loaded HODs
      // manager_id is the employee_id of the HOD, so we need to match it
      const matchingHod = hods.find((hod) => 
        hod.employee_id?.toString() === formData.hod_id ||
        hod.id?.toString() === formData.hod_id ||
        hod.user_id?.toString() === formData.hod_id
      );
      
      if (matchingHod) {
        // Update hod_id to match the dropdown value format
        const correctHodId = matchingHod.employee_id?.toString() || matchingHod.id?.toString() || matchingHod.user_id?.toString() || '';
        if (correctHodId && correctHodId !== formData.hod_id) {
          setFormData(prev => ({ ...prev, hod_id: correctHodId }));
        }
      }
    }
  }, [hods]);

  // Update Admin selection when Admins are loaded and we have an admin_id
  // CRITICAL: Only run when admins change, not when formData.admin_id changes
  // This prevents infinite loops and unwanted resets
  useEffect(() => {
    if (admins.length > 0 && formData.admin_id && formData.admin_id.trim() !== '') {
      console.log('🔍 Checking admin_id matching. Current formData.admin_id:', formData.admin_id);
      
      // Try to match the current admin_id with the loaded Admins
      // admin_id is the employee_id of the Admin, so we need to match it
      const matchingAdmin = admins.find((admin) => 
        admin.employee_id?.toString() === formData.admin_id?.toString() ||
        admin.id?.toString() === formData.admin_id?.toString() ||
        admin.user_id?.toString() === formData.admin_id?.toString()
      );
      
      if (matchingAdmin) {
        // Update admin_id to match the dropdown value format (prefer employee_id)
        const correctAdminId = matchingAdmin.employee_id?.toString() || matchingAdmin.id?.toString() || matchingAdmin.user_id?.toString() || '';
        console.log('✅ Found matching admin:', matchingAdmin.full_name || matchingAdmin.email, 'with employee_id:', correctAdminId);
        // Only update if the value actually needs to change (to prevent loops)
        if (correctAdminId && correctAdminId !== formData.admin_id) {
          console.log('🔄 Updating formData.admin_id from', formData.admin_id, 'to', correctAdminId);
          setFormData(prev => ({ ...prev, admin_id: correctAdminId }));
        }
      } else {
        console.warn('⚠️ No matching admin found for admin_id:', formData.admin_id);
        // Don't clear admin_id - it might be valid but not in the list yet
        // The user might have selected it before admins loaded
      }
    }
  }, [admins]); // Only depend on admins, not formData.admin_id

  // Refetch departments and HODs when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDepartments();
        fetchHods();
      }
    };

    const handleFocus = () => {
      fetchDepartments();
      fetchHods();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchEmployee = async () => {
    try {
      setFetching(true);
      const response = await api.get('/User/EmployeeList');
      const employees = response.data?.data || response.data || [];
      const employee = employees.find((emp: any) => 
        (emp.user_id || emp.id)?.toString() === employeeId
      );
      
      if (employee) {
        console.log('📋 Full employee data from API:', employee);
        
        // Get current HOD assignment (manager_id)
        // manager_id is the employee_id of the HOD
        // We need to match it with the HOD dropdown values (employee_id, id, or user_id)
        let currentHodId = '';
        if (employee.manager_id) {
          // manager_id is the employee_id of the HOD
          // Store it as-is, and we'll match it in the dropdown
          currentHodId = employee.manager_id.toString();
          console.log('✅ Current HOD manager_id:', currentHodId);
        } else {
          console.log('ℹ️ No manager_id (HOD) assigned');
        }

        // Get current Admin assignment (admin_id) - for HODs
        let currentAdminId = '';
        if (employee.admin_id !== null && employee.admin_id !== undefined) {
          currentAdminId = employee.admin_id.toString();
          console.log('✅ Current Admin admin_id from API:', currentAdminId, '(type:', typeof employee.admin_id, ')');
          console.log('📊 Admin data from API:', {
            admin_id: employee.admin_id,
            admin_email: employee.admin_email,
            admin_name: employee.admin_name
          });
        } else {
          console.log('ℹ️ No admin_id (Admin) assigned - admin_id is:', employee.admin_id);
        }
        
        // Normalize role to lowercase for consistent comparison
        const normalizedRole = (employee.role || 'employee').toLowerCase().trim();
        console.log('📝 Employee role from DB:', employee.role, 'Normalized:', normalizedRole);
        console.log('📱 Phone number from DB:', employee.phone_number, '(type:', typeof employee.phone_number, ')');
        
        // Normalize location for display: Map old values to new format
        let normalizedLocation = employee.location || '';
        if (normalizedLocation) {
          const locationLower = normalizedLocation.toLowerCase();
          if (locationLower.includes('india') || locationLower === 'in') {
            normalizedLocation = 'IN';
          } else if (locationLower.includes('us') || locationLower.includes('miami') || locationLower === 'us') {
            normalizedLocation = 'US';
          }
        }
        
        // CRITICAL: Preserve existing admin_id if it exists and API returns null
        // This prevents clearing admin_id during refetch if update hasn't propagated yet
        // Only use API value if it's not null/undefined, otherwise preserve existing
        const finalAdminId = (currentAdminId && currentAdminId.trim() !== '') 
          ? currentAdminId 
          : (formData.admin_id || '');
        
        setFormData({
          full_name: employee.full_name || '',
          email: employee.email || '',
          role: normalizedRole,
          location: normalizedLocation,
          department: employee.team || employee.department || '',
          designation: employee.designation || '',
          hod_id: currentHodId,
          admin_id: finalAdminId, // Use API value, but preserve existing if API is null
          phone_number: employee.phone_number || '',
        });
        
        console.log('✅ Form data set:', {
          location: employee.location || '',
          phone_number: employee.phone_number || '',
          admin_id_from_api: currentAdminId,
          admin_id_preserved: formData.admin_id,
          admin_id_final: finalAdminId,
          admin_id_type: typeof finalAdminId,
          hod_id: currentHodId,
          employee_admin_id: employee.admin_id,
          employee_admin_email: employee.admin_email,
          employee_admin_name: employee.admin_name,
          role: normalizedRole
        });
      } else {
        setError('Employee not found');
      }
    } catch (err: any) {
      console.error('Failed to fetch employee:', err);
      setError('Failed to load employee details');
    } finally {
      setFetching(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/Department/DepartmentList');
      const deptList = response.data?.Data || response.data?.data || response.data || [];
      setDepartments(deptList);
    } catch (err: any) {
      console.error('Failed to fetch departments:', err);
      setDepartments([]);
    }
  };

  const fetchHods = async () => {
    try {
      setHodsLoading(true);
      setHodsError('');
      console.log('Fetching HODs from /User/HodsList...');
      
      const response = await api.get('/User/HodsList');
      console.log('HODs API response status:', response.status);
      console.log('HODs API response data:', response.data);
      
      const hodsList = response.data?.Data || response.data?.data || response.data || [];
      console.log('HODs loaded:', hodsList.length, hodsList);
      
      if (!Array.isArray(hodsList)) {
        console.error('Invalid response format - not an array:', hodsList);
        throw new Error('Invalid response format from server');
      }
      
      setHods(hodsList);
      
      if (hodsList.length === 0) {
        setHodsError('No HODs found in the system. Please create a HOD user first.');
      }
    } catch (err: any) {
      console.error('Failed to fetch HODs - Full error:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      console.error('Error message:', err.message);
      console.error('Error config:', err.config);
      
      setHods([]);
      
      // Handle different error types
      let errorMessage = 'Failed to load HODs';
      
      if (err.response) {
        // Server responded with error
        const status = err.response.status;
        const data = err.response.data;
        
        if (status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (status === 403) {
          // 403 = Permission denied - this is expected for non-admins
          // Don't show error, just silently fail (HODs don't need HODs list)
          errorMessage = '';
          setHods([]);
          return; // Exit early, don't set error message
        } else if (status === 500) {
          errorMessage = data?.message || 'Server error. Please try again later.';
        } else {
          errorMessage = data?.message || data?.error || `Server error (${status})`;
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        // Something else happened
        errorMessage = err.message || 'Unknown error occurred';
      }
      
      setHodsError(`Error loading HODs: ${errorMessage}`);
    } finally {
      setHodsLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      setAdminsLoading(true);
      const response = await api.get('/User/AdminsList');
      const adminsList = response.data?.Data || response.data?.data || response.data || [];
      setAdmins(adminsList);
    } catch (err: any) {
      console.error('Failed to fetch Admins:', err);
      // If 403, it's expected for non-admins - silently fail
      if (err.response?.status === 403) {
        console.log('Access denied to Admins list (expected for non-admins)');
      }
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError('');

    try {
      // Validate: Admin assignment is mandatory for HODs
      if (formData.role?.toLowerCase() === 'hod' && isAdmin && !isAdminEditingSelf) {
        if (!formData.admin_id || formData.admin_id.trim() === '') {
          setError('Assign Admin is required for HODs');
          setLoading(false);
          return;
        }
      }
      
      console.log('📤 Submitting employee update with data:', {
        employeeId,
        hod_id: formData.hod_id,
        hod_id_type: typeof formData.hod_id,
        role: formData.role,
        ...formData
      });
      
      // Location is already "IN" or "US" from dropdown - no normalization needed
      // CRITICAL: Always send location, even if empty (to allow clearing location)
      const updateData: any = {
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        location: formData.location || null, // Send null if empty, but always include the field
        department: formData.department,
        designation: formData.designation,
        phone_number: formData.phone_number || null, // Ensure phone_number is sent
      };
      
      // Always send hod_id/admin_id if user is admin (not HOD) and not editing themselves
      // This ensures admin assignment is saved correctly
      if (isAdmin && !isAdminEditingSelf) {
        // Send hod_id - use null instead of empty string
        updateData.hod_id = formData.hod_id && formData.hod_id.trim() !== '' ? formData.hod_id : null;
        
        // Always send admin_id for HODs - use null instead of empty string
        // This is critical for saving admin assignment
        // Send admin_id even if empty to allow clearing the assignment
        if (formData.role?.toLowerCase() === 'hod') {
          updateData.admin_id = formData.admin_id && formData.admin_id.trim() !== '' ? formData.admin_id : null;
          console.log('📤 Admin assignment data for HOD:', {
            admin_id: updateData.admin_id,
            admin_id_type: typeof updateData.admin_id,
            admin_id_original: formData.admin_id,
            role: formData.role,
            isAdmin: isAdmin,
            isAdminEditingSelf: isAdminEditingSelf
          });
        } else {
          // For non-HODs, don't send admin_id (it will be ignored anyway)
          console.log('ℹ️ Not sending admin_id - role is not HOD:', formData.role);
        }
      } else {
        console.warn('⚠️ Not sending admin_id - user is not admin or is editing self:', {
          isAdmin,
          isAdminEditingSelf,
          role: formData.role
        });
        // Even if not admin, if role is HOD, we should still try to send admin_id
        // But this should only happen if permissions allow it
        // For now, keep the restriction but log it clearly
      }
      
      console.log('📤 Submitting employee update with data:', {
        ...updateData,
        location_value: formData.location,
        location_type: typeof formData.location,
        location_in_payload: updateData.location,
        admin_id_in_payload: updateData.admin_id,
        admin_id_type: typeof updateData.admin_id
      });
      console.log('📤 HOD ID being sent:', updateData.hod_id, '(type:', typeof updateData.hod_id, ')');
      console.log('📤 Admin ID being sent:', updateData.admin_id, '(type:', typeof updateData.admin_id, ')');
      
      await api.patch(`/User/UpdateEmployee/${employeeId}`, updateData);
      
      // Check if the updated employee is the current logged-in user
      const currentUserResponse = await api.get('/Auth/Me');
      const currentUserId = currentUserResponse.data?.user?.user_id || currentUserResponse.data?.user?.id;
      
      if (currentUserId?.toString() === employeeId) {
        // If updating current user, trigger user profile refresh
        localStorage.setItem('user_updated', 'true');
        // Dispatch storage event for same-tab refresh
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'user_updated',
          newValue: 'true'
        }));
      }
      
      alert('Employee updated successfully!');
      // CRITICAL: Don't refetch here - it causes double API call and form reset
      // The redirect with ?refresh=true will trigger EmployeeList to refetch
      // This prevents admin_id from being cleared before redirect
      router.push('/dashboard/employees?refresh=true');
    } catch (err: any) {
      console.error('Employee update error:', err);
      if (err.response?.status === 401) {
        // 401 = Authentication failed - redirect to login
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (err.response?.status === 403) {
        // 403 = Permission denied - show error but don't redirect
        // This should not happen if HODs have employee.edit permission
        const errorMsg = err.response?.data?.message || 'You do not have permission to edit employees. Please contact your administrator.';
        setError(errorMsg);
        console.error('Permission denied:', errorMsg);
        // Don't redirect to login on 403 - just show error
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to update employee');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Employees', path: '/dashboard/employees' },
          { label: 'Edit Employee', path: `/dashboard/employees/edit/${employeeId}`, active: true },
        ]}
        title="Edit Employee"
      />

      <div className="card mt-6">
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Role */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    // CRITICAL: Preserve admin_id when role changes
                    // Only clear hod_id if role changes to HOD (HODs don't have HODs)
                    // Do NOT clear admin_id - it should persist
                    setFormData({ 
                      ...formData, 
                      role: newRole,
                      hod_id: newRole.toLowerCase() === 'hod' ? '' : formData.hod_id,
                      // Preserve admin_id - don't clear it
                      admin_id: formData.admin_id
                    });
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                >
                  <option value="employee">Employee</option>
                  <option value="hod">HOD</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <select
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                >
                  <option value="">Select Location</option>
                  <option value="IN">India</option>
                  <option value="US">United States</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the employee's country
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Department */}
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Designation */}
              <div>
                <label htmlFor="designation" className="block text-sm font-medium text-gray-700 mb-2">
                  Designation
                </label>
                <input
                  id="designation"
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phone Number */}
              <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  id="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                />
              </div>
            </div>

            {/* HOD Assignment - Mandatory (only for employees, not for HODs or Admin editing self) */}
            {/* Only show if user is admin (HODs don't need to assign HODs) */}
            {formData.role?.toLowerCase() === 'employee' && !isAdminEditingSelf && isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="hod_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Assign HOD <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="hod_id"
                    value={formData.hod_id}
                    onChange={(e) => setFormData({ ...formData, hod_id: e.target.value })}
                    required
                    disabled={hodsLoading}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm ${
                      hodsError ? 'border-red-300' : 'border-gray-300'
                    } ${hodsLoading ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  >
                    <option value="">{hodsLoading ? 'Loading HODs...' : 'Select HOD'}</option>
                    {hods.length === 0 && !hodsLoading ? (
                      <option value="" disabled>No HODs available</option>
                    ) : (
                      hods.map((hod) => {
                        // Use employee_id first, then id (user_id), then user_id as fallback
                        const hodValue = hod.employee_id?.toString() || hod.id?.toString() || hod.user_id?.toString() || '';
                        return (
                          <option key={hod.user_id || hod.id || hod.employee_id} value={hodValue}>
                            {hod.full_name || hod.email} ({hod.email})
                          </option>
                        );
                      })
                    )}
                  </select>
                  {hodsError && (
                    <p className="mt-1 text-xs text-red-600">{hodsError}</p>
                  )}
                  {!hodsError && (
                    <p className="mt-1 text-xs text-gray-500">
                      Select the HOD who will approve this employee's leave applications
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Admin Assignment - Only for HODs (Mandatory) */}
            {/* Only show if user is admin (HODs don't need to assign Admins) */}
            {(formData.role?.toLowerCase() === 'hod' || formData.role?.toLowerCase() === 'HOD') && !isAdminEditingSelf && isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="admin_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Admin <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="admin_id"
                    value={formData.admin_id}
                    onChange={(e) => setFormData({ ...formData, admin_id: e.target.value })}
                    disabled={adminsLoading}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm ${
                      adminsLoading ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'
                    }`}
                  >
                    <option value="">{adminsLoading ? 'Loading Admins...' : 'Select Admin'}</option>
                    {admins.length === 0 && !adminsLoading ? (
                      <option value="" disabled>No Admins available</option>
                    ) : (
                      admins.map((admin) => {
                        const adminValue = admin.employee_id?.toString() || admin.id?.toString() || admin.user_id?.toString() || '';
                        return (
                          <option key={admin.user_id || admin.id || admin.employee_id} value={adminValue}>
                            {admin.full_name || admin.email} ({admin.email})
                          </option>
                        );
                      })
                    )}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Select the Admin who will receive notifications when this HOD approves leaves (Required)
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {loading ? 'Updating...' : 'Update Employee'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


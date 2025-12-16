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
    hod_id: '', // HOD assignment (manager_id)
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [hods, setHods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [hodsError, setHodsError] = useState('');
  const [hodsLoading, setHodsLoading] = useState(true);

  useEffect(() => {
    if (employeeId) {
      fetchEmployee();
      fetchDepartments();
      fetchHods();
    }
  }, [employeeId]);

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
        // Get current HOD assignment (manager_id)
        // manager_id is the employee_id of the HOD
        // We need to match it with the HOD dropdown values (employee_id, id, or user_id)
        let currentHodId = '';
        if (employee.manager_id) {
          // manager_id is the employee_id of the HOD
          // Store it as-is, and we'll match it in the dropdown
          currentHodId = employee.manager_id.toString();
          console.log('Current HOD manager_id:', currentHodId);
        }
        
        setFormData({
          full_name: employee.full_name || '',
          email: employee.email || '',
          role: employee.role || 'employee',
          location: employee.location || '',
          department: employee.team || employee.department || '',
          designation: employee.designation || '',
          hod_id: currentHodId,
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
          errorMessage = 'Access denied. Admin privileges required to view HODs.';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('📤 Submitting employee update with data:', {
        employeeId,
        hod_id: formData.hod_id,
        hod_id_type: typeof formData.hod_id,
        role: formData.role,
        ...formData
      });
      
      // Update employee details
      const updateData = {
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        location: formData.location,
        department: formData.department,
        designation: formData.designation,
        hod_id: formData.hod_id || '', // HOD assignment - send empty string if not selected
      };
      
      console.log('📤 Sending update request with data:', updateData);
      console.log('📤 HOD ID being sent:', updateData.hod_id, '(type:', typeof updateData.hod_id, ')');
      
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
      router.push('/dashboard/employees?refresh=true');
    } catch (err: any) {
      console.error('Employee update error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
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

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
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
                    // Clear HOD assignment if role is changed to HOD
                    setFormData({ 
                      ...formData, 
                      role: newRole,
                      hod_id: newRole.toLowerCase() === 'hod' ? '' : formData.hod_id
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
                <input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                />
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

            {/* HOD Assignment - Mandatory (only for employees, not for HODs) */}
            {formData.role?.toLowerCase() !== 'hod' && (
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


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';

export default function CreateEmployeePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
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
  const [error, setError] = useState('');
  const [hodsError, setHodsError] = useState('');
  const [hodsLoading, setHodsLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
    fetchHods();
    fetchAdmins();
  }, []);

  // Refetch departments and HODs when page becomes visible (user navigates back from creating department)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDepartments();
        fetchHods();
        fetchAdmins();
      }
    };

    const handleFocus = () => {
      fetchDepartments();
      fetchHods();
      fetchAdmins();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/Department/DepartmentList');
      const deptList = response.data?.Data || response.data?.data || response.data || [];
      setDepartments(deptList);
      console.log('Departments loaded:', deptList.length);
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

  const fetchAdmins = async () => {
    try {
      setAdminsLoading(true);
      const response = await api.get('/User/AdminsList');
      const adminsList = response.data?.Data || response.data?.data || response.data || [];
      setAdmins(adminsList);
    } catch (err: any) {
      console.error('Failed to fetch Admins:', err);
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/Auth/RegisterUser', formData);
      // Redirect with refresh parameter to trigger refetch
      router.push('/dashboard/employees?refresh=true');
    } catch (err: any) {
      console.error('Employee creation error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(err.response?.data?.message || 'Failed to create employee');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Employees', path: '/dashboard/employees' },
          { label: 'Create Employee', path: '/dashboard/employees/create', active: true },
        ]}
        title="Create Employee"
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
              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                />
              </div>

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
                    // Clear HOD assignment if role is changed to HOD or Admin
                    // Clear Admin assignment if role is changed to Employee or Admin
                    setFormData({ 
                      ...formData, 
                      role: newRole,
                      hod_id: (newRole.toLowerCase() === 'hod' || newRole.toLowerCase() === 'admin') ? '' : formData.hod_id,
                      admin_id: (newRole.toLowerCase() === 'employee' || newRole.toLowerCase() === 'admin') ? '' : formData.admin_id
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* HOD Assignment - Only for employees */}
              {formData.role?.toLowerCase() === 'employee' && (
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
              )}

              {/* Admin Assignment - Only for HODs */}
              {formData.role?.toLowerCase() === 'hod' && (
                <div>
                  <label htmlFor="admin_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Admin
                  </label>
                  <select
                    id="admin_id"
                    value={formData.admin_id}
                    onChange={(e) => setFormData({ ...formData, admin_id: e.target.value })}
                    disabled={adminsLoading}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm ${
                      adminsLoading ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'
                    }`}
                  >
                    <option value="">{adminsLoading ? 'Loading Admins...' : 'Select Admin (Optional)'}</option>
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
                    Select the Admin who will receive notifications when this HOD approves leaves
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="mt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {loading ? 'Creating...' : 'Create Employee'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


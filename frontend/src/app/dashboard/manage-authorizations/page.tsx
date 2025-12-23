'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, Check, X, Search, User, Lock } from 'lucide-react';
import Button from '@/components/Common/Button';

interface Permission {
  permission_id: number;
  permission_key: string;
  permission_name: string;
  description: string;
  category: string;
}

interface UserPermission {
  user_id: number;
  email: string;
  full_name: string;
  role: string;
  permissions: Permission[];
}

export default function ManageAuthorizationsPage() {
  const router = useRouter();
  
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserPermission | null>(null);
  const [userPermissions, setUserPermissions] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRole();
    fetchPermissionsData();
  }, []);

  const fetchUserRole = async () => {
    try {
      const response = await api.get('/Auth/Me');
      if (response.data?.user?.role) {
        const role = response.data.user.role.toLowerCase();
        setUserRole(role);
        if (role !== 'admin') {
          router.push('/dashboard');
        }
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error);
      router.push('/login');
    }
  };

  const fetchPermissionsData = async () => {
    try {
      setLoading(true);
      const [usersResponse, permissionsResponse] = await Promise.all([
        api.get('/Permission/GetAllUsersWithPermissions'),
        api.get('/Permission/GetAllPermissions')
      ]);

      if (usersResponse.data?.data) {
        setUsers(usersResponse.data.data);
      }

      if (permissionsResponse.data?.data) {
        // Filter out calendar.block permission
        const filteredPermissions = permissionsResponse.data.data.filter(
          (perm: Permission) => perm.permission_key !== 'calendar.block'
        );
        setAllPermissions(filteredPermissions);
      }
    } catch (error: any) {
      console.error('Failed to fetch permissions data:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: UserPermission) => {
    if (user.role?.toLowerCase() === 'admin') {
      return;
    }
    
    setSelectedUser(user);
    // Check ALL permissions by default (all permission IDs)
    const allPermIds = new Set(allPermissions.map(p => p.permission_id));
    setUserPermissions(allPermIds);
    setHasChanges(false);
  };

  const handlePermissionToggle = (permissionId: number) => {
    if (!selectedUser || selectedUser.role?.toLowerCase() === 'admin') return;
    
    const newPermissions = new Set(userPermissions);
    if (newPermissions.has(permissionId)) {
      newPermissions.delete(permissionId);
    } else {
      newPermissions.add(permissionId);
    }
    setUserPermissions(newPermissions);
    setHasChanges(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      
      const currentPermIds = selectedUser.permissions.map(p => p.permission_id);
      const newPermIds = Array.from(userPermissions);
      
      const toAdd = newPermIds.filter(id => !currentPermIds.includes(id));
      const toRemove = currentPermIds.filter(id => !newPermIds.includes(id));
      
      if (toAdd.length > 0) {
        await api.post('/Permission/BulkAssignPermissions', {
          userId: selectedUser.user_id,
          permissionIds: toAdd
        });
      }
      
      for (const permId of toRemove) {
        await api.post('/Permission/RevokePermission', {
          userId: selectedUser.user_id,
          permissionId: permId
        });
      }
      
      await fetchPermissionsData();
      
      const updatedUser = users.find(u => u.user_id === selectedUser.user_id);
      if (updatedUser) {
        handleUserSelect(updatedUser);
      }
      
      alert('Permissions updated successfully!');
    } catch (error: any) {
      console.error('Failed to save permissions:', error);
      alert(error.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = userSearchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.full_name.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    );
  });

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No users found
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isAdmin = user.role?.toLowerCase() === 'admin';
                  const isSelected = selectedUser?.user_id === user.user_id;
                  
                  return (
                    <div
                      key={user.user_id}
                      onClick={() => !isAdmin && handleUserSelect(user)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : isAdmin
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">
                            {user.full_name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {user.email}
                          </div>
                          <div className="mt-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              isAdmin 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                            {isAdmin && (
                              <span className="ml-2 text-xs text-gray-500">(All permissions)</span>
                            )}
                          </div>
                        </div>
                        {!isAdmin && (
                          <div className="text-xs text-gray-400 ml-2">
                            {user.permissions.length}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="lg:col-span-2">
          {selectedUser ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedUser.full_name}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
                {hasChanges && (
                  <Button
                    onClick={handleSavePermissions}
                    disabled={saving}
                    variant="primary"
                    size="md"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {Object.entries(groupedPermissions).map(([category, perms]) => {
                  // Filter permissions based on selected user's role
                  const userRoleLower = selectedUser.role?.toLowerCase() || '';
                  
                  // For Employees: Completely hide unauthorized categories
                  if (userRoleLower === 'employee') {
                    const categoryLower = category.toLowerCase();
                    // Hide these categories completely for Employees
                    if (categoryLower === 'authorization' || 
                        categoryLower === 'department' || 
                        categoryLower === 'employee' ||
                        categoryLower === 'permissions') {
                      return null; // Don't show this category at all
                    }
                    
                    // Leave Type - Employees should not see
                    if (categoryLower === 'leave type' || categoryLower === 'leavetype') {
                      return null;
                    }
                  }
                  
                  const filteredPerms = perms.filter((perm) => {
                    // Permissions Management - Admin only
                    if (category.toLowerCase() === 'permissions') {
                      return userRoleLower === 'admin';
                    }
                    
                    // Leave Type - Admin and HOD only
                    if (category.toLowerCase() === 'leave type' || category.toLowerCase() === 'leavetype') {
                      return userRoleLower === 'admin' || userRoleLower === 'hod';
                    }
                    
                    // Authorization - Hide completely for Employees
                    if (category.toLowerCase() === 'authorization') {
                      // Employees should not see any authorization permissions
                      if (userRoleLower === 'employee') {
                        return false;
                      }
                      // HOD and Admin can see all authorization permissions
                      return true;
                    }
                    
                    // Leave permissions - Filter for employees
                    if (category.toLowerCase() === 'leave') {
                      if (userRoleLower === 'employee') {
                        const key = perm.permission_key.toLowerCase();
                        // Employees should only see: apply, edit_own, delete_own, view_own
                        return key.includes('apply') || 
                               key.includes('edit_own') || 
                               key.includes('delete_own') || 
                               key.includes('view_own');
                      }
                      // Admin and HOD can see all leave permissions
                      return true;
                    }
                    
                    // Department - Hide completely for Employees
                    if (category.toLowerCase() === 'department') {
                      if (userRoleLower === 'employee') {
                        return false;
                      }
                      return true;
                    }
                    
                    // Employee permissions - Hide completely for Employees
                    if (category.toLowerCase() === 'employee') {
                      if (userRoleLower === 'employee') {
                        return false;
                      }
                      // HOD can have employee management permissions if granted
                      // Admin can have all
                      return true;
                    }
                    
                    // All other permissions - show based on role
                    return true;
                  });
                  
                  // Don't show category if no permissions after filtering
                  if (filteredPerms.length === 0) {
                    return null;
                  }
                  
                  return (
                    <div key={category} className="border-b border-gray-200 pb-3 last:border-0">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {filteredPerms.map((perm) => {
                          const isChecked = userPermissions.has(perm.permission_id);
                          return (
                            <label
                              key={perm.permission_id}
                              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handlePermissionToggle(perm.permission_id)}
                                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {perm.permission_name}
                                  </span>
                                  {isChecked ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <X className="w-4 h-4 text-gray-300" />
                                  )}
                                </div>
                                {perm.description && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {perm.description}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <User className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-900 mb-1">
                Select a User
              </h3>
              <p className="text-gray-600 text-xs">
                Choose a user to manage permissions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListHodPage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const [userResponse, permissionsResponse] = await Promise.all([
        api.get('/Auth/Me').catch(() => ({ data: { user: { role: 'employee' } } })),
        api.get('/Permission/GetMyPermissions').catch(() => ({ data: { data: [] } }))
      ]);
      
      const userRole = userResponse.data?.user?.role?.toLowerCase() || 'employee';
      const userPermissions = permissionsResponse.data?.data || [];
      
      // Check if user has leave.view_own or leave.view_all permission
      const hasViewOwn = userPermissions.includes('leave.view_own');
      const hasViewAll = userPermissions.includes('leave.view_all');
      
      // HOD must have permission (no admin bypass for HOD)
      if (userRole === 'hod' || userRole === 'HOD') {
        if (!hasViewOwn && !hasViewAll) {
          router.push('/dashboard');
          return;
        }
      } else if (userRole === 'admin') {
        // Admin can access, but still check permissions for consistency
        if (!hasViewOwn && !hasViewAll) {
          router.push('/dashboard');
          return;
        }
      } else {
        // Other roles cannot access HOD leave list
        router.push('/dashboard');
        return;
      }
      
      setPermissions(userPermissions);
    } catch (error) {
      console.error('Failed to check permissions:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <LeaveListTable
      endpoint="/Leave/LeaveListHod"
      title="Leave List HOD"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-hod' },
        { label: 'HOD List', path: '/dashboard/leaves-hod', active: true },
      ]}
    />
  );
}














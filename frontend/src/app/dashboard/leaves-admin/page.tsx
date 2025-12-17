'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListAdminPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveAdminList"
      title="Leave List Admin"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-admin' },
        { label: 'Admin List', path: '/dashboard/leaves-admin', active: true },
      ]}
    />
  );
}









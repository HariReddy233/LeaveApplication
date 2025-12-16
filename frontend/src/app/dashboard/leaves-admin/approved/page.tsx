'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListAdminApprovedPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveListAdminByStatus"
      title="Leave List Admin Approved"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-admin' },
        { label: 'Approved', path: '/dashboard/leaves-admin/approved', active: true },
      ]}
      status="Approved"
      method="POST"
    />
  );
}


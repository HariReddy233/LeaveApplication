'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListAdminPendingPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveListAdminByStatus"
      title="Leave List Admin Pending"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-admin' },
        { label: 'Pending', path: '/dashboard/leaves-admin/pending', active: true },
      ]}
      status="Pending"
      method="POST"
    />
  );
}


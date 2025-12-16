'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListAdminRejectedPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveListAdminByStatus"
      title="Leave List Admin Rejected"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-admin' },
        { label: 'Rejected', path: '/dashboard/leaves-admin/rejected', active: true },
      ]}
      status="Rejected"
      method="POST"
    />
  );
}


'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListRejectedPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveList"
      title="Leave List Rejected"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves' },
        { label: 'Rejected', path: '/dashboard/leaves/rejected', active: true },
      ]}
      status="Rejected"
    />
  );
}



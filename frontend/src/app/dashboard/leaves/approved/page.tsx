'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListApprovedPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveList"
      title="Leave List Approved"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves' },
        { label: 'Approved', path: '/dashboard/leaves/approved', active: true },
      ]}
      status="Approved"
    />
  );
}



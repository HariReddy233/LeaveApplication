'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListPendingPage() {
  // For employee, filter client-side or use a different endpoint
  // Since employee sees their own leaves, we'll filter by AdminStatus
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveList"
      title="Leave List Pending"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves' },
        { label: 'Pending', path: '/dashboard/leaves/pending', active: true },
      ]}
      status="Pending"
    />
  );
}


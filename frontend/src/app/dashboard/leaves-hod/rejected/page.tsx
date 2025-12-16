'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListHodRejectedPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveListHodByStatus"
      title="Leave List HOD Rejected"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-hod' },
        { label: 'Rejected', path: '/dashboard/leaves-hod/rejected', active: true },
      ]}
      status="Rejected"
      method="POST"
    />
  );
}


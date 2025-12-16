'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListHodPendingPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveListHodByStatus"
      title="Leave List HOD Pending"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-hod' },
        { label: 'Pending', path: '/dashboard/leaves-hod/pending', active: true },
      ]}
      status="Pending"
      method="POST"
    />
  );
}


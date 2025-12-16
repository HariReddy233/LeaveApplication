'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListHodApprovedPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveListHodByStatus"
      title="Leave List HOD Approved"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-hod' },
        { label: 'Approved', path: '/dashboard/leaves-hod/approved', active: true },
      ]}
      status="Approved"
      method="POST"
    />
  );
}


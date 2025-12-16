'use client';

import LeaveListTable from '@/components/Leave/LeaveListTable';

export default function LeaveListHodPage() {
  return (
    <LeaveListTable
      endpoint="/Leave/LeaveListHod"
      title="Leave List HOD"
      breadCrumbItems={[
        { label: 'Leave', path: '/dashboard/leaves-hod' },
        { label: 'HOD List', path: '/dashboard/leaves-hod', active: true },
      ]}
    />
  );
}







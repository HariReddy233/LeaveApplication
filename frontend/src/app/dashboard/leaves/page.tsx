'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactPaginate from 'react-paginate';
import { Edit, Trash2, Settings, FileText, FileSpreadsheet } from 'lucide-react';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import DateFormatter from '@/utils/DateFormatter';
import ExportDataJSON from '@/utils/ExportFromJSON';
import classNames from 'classnames';
import React from 'react';

export default function MyLeavesPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [pageNumber, setPageNumber] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [searchKey, setSearchKey] = useState('0');
  const [debouncedSearchKey, setDebouncedSearchKey] = useState('0');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [totalLeave, setTotalLeave] = useState(0);
  const [loading, setLoading] = useState(true);

  // Generate year options (current year and previous 2 years, next year)
  const yearOptions = [];
  for (let i = currentYear - 2; i <= currentYear + 1; i++) {
    yearOptions.push(i);
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchKey(searchKey);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKey]);

  useEffect(() => {
    fetchLeaves();
  }, [pageNumber, perPage, debouncedSearchKey, selectedYear]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/Leave/LeaveList/${pageNumber}/${perPage}/${debouncedSearchKey}`, {
        params: { year: selectedYear }
      });
      
      if (response.data) {
        const data = Array.isArray(response.data.Data) ? response.data.Data : [];
        const total = response.data.Total?.[0]?.count || 0;
        setLeaves(data);
        setTotalLeave(total);
      } else {
        setLeaves([]);
        setTotalLeave(0);
      }
    } catch (err: any) {
      setLeaves([]);
      setTotalLeave(0);
    } finally {
      setLoading(false);
    }
  };

  const PerPageOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'All') {
      setPerPage(totalLeave);
    } else {
      setPerPage(parseInt(e.target.value));
    }
    setPageNumber(1);
  };

  const SearchKeywordOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value || '0';
    setSearchKey(key);
    setPageNumber(1);
  };

  const HandlePageClick = (e: { selected: number }) => {
    setPageNumber(e.selected + 1);
  };

  const GoToPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= Math.ceil(totalLeave / perPage)) {
      setPageNumber(page);
    }
  };

  const DeleteLeave = async (id: number) => {
    if (!confirm('Are you sure you want to delete this leave application?')) {
      return;
    }
    try {
      await api.delete(`/Leave/LeaveDelete/${id}`);
      fetchLeaves();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete leave');
    }
  };

  if (loading) {
    return (
      <>
        <PageTitle
          breadCrumbItems={[
            { label: 'Leave', path: '/dashboard/leaves' },
            {
              label: 'Leave List',
              path: '/dashboard/leaves',
              active: true,
            },
          ]}
          title="Leave List"
        />
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <div className="text-gray-500">Loading leave applications...</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        breadCrumbItems={[
          { label: 'Leave', path: '/dashboard/leaves' },
          {
            label: 'Leave List',
            path: '/dashboard/leaves',
            active: true,
          },
        ]}
        title={`Leave List ${totalLeave}`}
      />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4">
          {/* Action Buttons Row */}
          <div className="flex justify-end mb-3">
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => ExportDataJSON(leaves, 'Leave', 'xls')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export
              </button>
              <button
                onClick={() => ExportDataJSON(leaves, 'Leave', 'csv')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>

          {/* Year and Search Row */}
          <div className="mb-3 flex items-center gap-4">
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-2">Year :</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setPageNumber(1);
                }}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-2">Search :</span>
              <input
                type="text"
                placeholder={`${totalLeave} records...`}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-auto"
                defaultValue=""
                onChange={SearchKeywordOnChange}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead style={{ backgroundColor: '#eef2f7' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Leave Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Application Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Total Day</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Hod Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Admin Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Action</th>
                </tr>
              </thead>
              <tbody>
                {leaves.length > 0 ? (
                  leaves.map((record: any, index: number) => {
                    if (!record) return null;
                    
                    const employee = record.Employee?.[0] || {};
                    const firstName = employee?.FirstName || '';
                    const lastName = employee?.LastName || '';
                    const fullName = `${firstName} ${lastName}`.trim() || record.full_name || 'N/A';
                    const email = employee?.Email || record.email || '';
                    
                    return (
                      <tr key={record.id || record._id || `leave-${index}`} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium text-xs">
                              {fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{fullName}</div>
                              <div className="text-xs text-gray-500">{email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.LeaveType || record.leave_type || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {record.createdAt || record.created_at || record.applied_date ? (
                            <DateFormatter date={record.createdAt || record.created_at || record.applied_date} />
                          ) : (
                            <span>N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.NumOfDay || record.number_of_days || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={classNames('px-2.5 py-1 rounded-full text-xs font-medium', {
                              'bg-green-100 text-green-800': record.HodStatus === 'Approved',
                              'bg-yellow-100 text-yellow-800': record.HodStatus === 'Pending',
                              'bg-red-100 text-red-800': record.HodStatus === 'Rejected',
                            })}
                          >
                            {record.HodStatus || record.hod_status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={classNames('px-2.5 py-1 rounded-full text-xs font-medium', {
                              'bg-green-100 text-green-800': record.AdminStatus === 'Approved',
                              'bg-yellow-100 text-yellow-800': record.AdminStatus === 'Pending',
                              'bg-red-100 text-red-800': record.AdminStatus === 'Rejected',
                            })}
                          >
                            {record.AdminStatus || record.admin_status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(record.HodStatus === 'Pending' || record.hod_status === 'Pending') ? (
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/dashboard/apply-leave?id=${record.id || record._id}`}
                                className="text-yellow-600 hover:text-yellow-800"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => DeleteLeave(record.id || record._id)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium text-base mb-1">No leave applications found</p>
                        <p className="text-gray-500 text-sm">You haven't applied for any leaves yet. Click the button below to apply for leave.</p>
                        <Link
                          href="/dashboard/apply-leave"
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium inline-flex items-center gap-2"
                        >
                          <span>+</span>
                          <span>Apply for Leave</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Display :</label>
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                value={perPage === totalLeave ? 'All' : perPage}
                onChange={PerPageOnChange}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value="All">All</option>
              </select>
            </div>
            <span className="text-sm text-gray-700">
              Page <strong>{pageNumber} of {Math.ceil(totalLeave / perPage) || 1}</strong>
            </span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Go to page :</label>
              <input
                type="number"
                min={1}
                max={Math.ceil(totalLeave / perPage) || 1}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                defaultValue={1}
                onChange={GoToPage}
              />
            </div>
            <ReactPaginate
              previousLabel="<"
              nextLabel=">"
              pageCount={Math.ceil(totalLeave / perPage) || 1}
              marginPagesDisplayed={2}
              pageRangeDisplayed={5}
              onPageChange={HandlePageClick}
              forcePage={pageNumber - 1}
              containerClassName="flex items-center gap-1"
              pageClassName="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100"
              pageLinkClassName="text-gray-700"
              previousClassName="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100"
              previousLinkClassName="text-gray-700"
              nextClassName="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100"
              nextLinkClassName="text-gray-700"
              breakClassName="px-2 py-1"
              breakLabel="..."
              activeClassName="bg-blue-600 text-white border-blue-600"
              activeLinkClassName="text-white"
              disabledClassName="opacity-50 cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    </>
  );
}

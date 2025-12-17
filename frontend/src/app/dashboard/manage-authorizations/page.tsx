'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CheckCircle, XCircle, Clock, AlertCircle, Search, Filter } from 'lucide-react';

export default function ManageAuthorizationsPage() {
  const router = useRouter();
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAuth, setSelectedAuth] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAuthorizations();
  }, [filterStatus]);

  const fetchAuthorizations = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      
      const response = await api.get('/Authorization/AuthorizationAdminList', { params });
      if (response.data?.data) {
        setAuthorizations(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch authorizations:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (authId: number, status: 'approved' | 'rejected') => {
    try {
      setProcessing(true);
      await api.patch(`/Authorization/AuthorizationApprove/${authId}`, {
        status,
        approval_comment: approvalComment,
      });
      setShowModal(false);
      setApprovalComment('');
      setSelectedAuth(null);
      fetchAuthorizations();
    } catch (error: any) {
      console.error('Failed to update authorization:', error);
      alert(error.response?.data?.message || 'Failed to update authorization');
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (auth: any, action: 'approve' | 'reject') => {
    setSelectedAuth({ ...auth, action });
    setShowModal(true);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    };

    const icons = {
      pending: <Clock className="w-4 h-4" />,
      approved: <CheckCircle className="w-4 h-4" />,
      rejected: <XCircle className="w-4 h-4" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.pending}`}>
        {icons[status as keyof typeof icons]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredAuthorizations = authorizations.filter(auth => {
    const matchesSearch = searchTerm === '' || 
      auth.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      auth.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      auth.authorization_type?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Manage Authorizations
        </h1>
        <p className="text-gray-600 text-sm mt-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Review and approve/reject authorization requests from employees
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by title, employee, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Authorizations List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredAuthorizations.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No authorization requests</h3>
            <p className="text-gray-600">No authorization requests found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAuthorizations.map((auth) => (
                  <tr key={auth.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{auth.employee_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{auth.employee_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{auth.title}</div>
                      {auth.requested_access && (
                        <div className="text-xs text-gray-500 mt-1">{auth.requested_access}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{auth.authorization_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(auth.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        auth.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        auth.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        auth.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {auth.priority?.charAt(0).toUpperCase() + auth.priority?.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(auth.requested_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {auth.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openModal(auth, 'approve')}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openModal(auth, 'reject')}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {auth.approver_name ? `By ${auth.approver_name}` : 'Processed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showModal && selectedAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedAuth.action === 'approve' ? 'Approve' : 'Reject'} Authorization Request
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Title:</strong> {selectedAuth.title}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Employee:</strong> {selectedAuth.employee_name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Type:</strong> {selectedAuth.authorization_type}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment (Optional)
              </label>
              <textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                placeholder="Add a comment..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(selectedAuth.id, selectedAuth.action === 'approve' ? 'approved' : 'rejected')}
                disabled={processing}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  selectedAuth.action === 'approve'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {processing ? 'Processing...' : selectedAuth.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedAuth(null);
                  setApprovalComment('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}










'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Shield } from 'lucide-react';

export default function MyAuthorizationsPage() {
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuthorizations();
  }, []);

  const fetchAuthorizations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/Authorization/AuthorizationList');
      setAuthorizations(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch authorizations:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        // Don't redirect - let layout handle it
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          My Authorizations
        </h1>
        <p className="text-gray-600 text-sm" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          View your authorization requests
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Authorization Requests</h2>
        </div>
        <div className="p-6">
          {authorizations.length > 0 ? (
            <div className="space-y-4">
              {authorizations.map((auth) => (
                <div
                  key={auth.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Shield className="w-5 h-5 text-gray-400" />
                        <h3 className="font-semibold text-gray-900">{auth.title}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            auth.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : auth.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {auth.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Type:</strong> {auth.authorization_type}
                      </p>
                      {auth.requested_access && (
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>Requested Access:</strong> {auth.requested_access}
                        </p>
                      )}
                      {auth.reason && (
                        <p className="text-sm text-gray-700 mt-2">{auth.reason}</p>
                      )}
                      {auth.approval_comment && (
                        <p className="text-sm text-gray-600 mt-2 italic">
                          Comment: {auth.approval_comment}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Requested: {new Date(auth.requested_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No authorization requests found. <a href="/dashboard/apply-authorization" className="text-blue-600 hover:underline">Request authorization</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



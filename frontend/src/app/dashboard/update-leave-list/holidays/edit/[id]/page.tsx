'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';

export default function EditHolidayPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    country_code: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchHoliday();
    }
  }, [id]);

  const fetchHoliday = async () => {
    try {
      setFetching(true);
      const response = await api.get('/Calendar/OrganizationHolidays');
      const holidays = response.data?.data || response.data || [];
      const holiday = holidays.find((h: any) => h.id === parseInt(id));
      
      if (holiday) {
        // Format date for input field (YYYY-MM-DD)
        let formattedDate = '';
        const dateValue = holiday.date || holiday.holiday_date;
        if (dateValue) {
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            formattedDate = date.toISOString().split('T')[0];
          }
        }
        
        setFormData({
          name: holiday.name || holiday.holiday_name || '',
          date: formattedDate,
          country_code: holiday.country_code || '',
        });
      } else {
        setError('Holiday not found');
      }
    } catch (err: any) {
      console.error('Failed to fetch holiday:', err);
      setError('Failed to load holiday details');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.put(`/Calendar/OrganizationHoliday/${id}`, {
        name: formData.name,
        date: formData.date,
        country_code: formData.country_code || null,
      });
      
      alert('Holiday updated successfully!');
      router.push('/dashboard/update-leave-list');
    } catch (err: any) {
      console.error('Holiday update error:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.message || 'You do not have permission to update holidays. Please contact your administrator.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to update holiday');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="page-container">
        <PageTitle
          breadCrumbItems={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Update Leave List', path: '/dashboard/update-leave-list' },
            { label: 'Edit Holiday', path: `/dashboard/update-leave-list/holidays/edit/${id}`, active: true },
          ]}
          title="Edit Holiday"
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Update Leave List', path: '/dashboard/update-leave-list' },
          { label: 'Edit Holiday', path: `/dashboard/update-leave-list/holidays/edit/${id}`, active: true },
        ]}
        title="Edit Holiday"
      />

      <div className="card mt-6">
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Holiday Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Holiday Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                  placeholder="e.g., New Year, Christmas"
                />
              </div>

              {/* Holiday Date */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  Holiday Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                />
              </div>

              {/* Country Code */}
              <div>
                <label htmlFor="country_code" className="block text-sm font-medium text-gray-700 mb-2">
                  Country Code
                </label>
                <select
                  id="country_code"
                  value={formData.country_code}
                  onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                >
                  <option value="">All Countries</option>
                  <option value="IN">IN (India)</option>
                  <option value="US">US (United States)</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/dashboard/update-leave-list')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update Holiday'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


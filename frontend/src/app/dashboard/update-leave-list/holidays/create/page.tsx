'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PageTitle from '@/components/Common/PageTitle';
import { FileText, Users, Calendar } from 'lucide-react';

export default function CreateHolidayPage() {
  const router = useRouter();
  const [formTab, setFormTab] = useState<'single' | 'bulk'>('single');
  
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    country_code: '',
    is_recurring: false,
  });
  const [bulkHolidays, setBulkHolidays] = useState<Array<{name: string, date: string, country_code: string}>>([
    { name: '', date: '', country_code: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [creatingBulk, setCreatingBulk] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.name || !formData.date) {
      setError('Holiday name and date are required');
      setLoading(false);
      return;
    }

    try {
      await api.post('/Calendar/OrganizationHoliday', {
        name: formData.name,
        date: formData.date,
        country_code: formData.country_code || null,
        is_recurring: formData.is_recurring,
      });
      
      alert('Holiday created successfully!');
      router.push('/dashboard/update-leave-list');
    } catch (err: any) {
      console.error('Holiday creation error:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.message || 'You do not have permission to create holidays. Please contact your administrator.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create holiday');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBulkHolidays = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBulk(true);
    setError('');

    // Filter out empty rows
    const validHolidays = bulkHolidays.filter(h => h.name && h.date);
    
    if (validHolidays.length === 0) {
      setError('Please add at least one holiday with name and date');
      setCreatingBulk(false);
      return;
    }

    try {
      await api.post('/Calendar/BulkOrganizationHolidays', {
        holidays: validHolidays.map(h => ({
          name: h.name,
          date: h.date,
          country_code: h.country_code || null,
        }))
      });
      
      alert(`${validHolidays.length} holiday(s) created successfully!`);
      router.push('/dashboard/update-leave-list');
    } catch (err: any) {
      console.error('Bulk holiday creation error:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.message || 'You do not have permission to create holidays. Please contact your administrator.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create holidays');
      }
    } finally {
      setCreatingBulk(false);
    }
  };

  return (
    <div className="page-container">
      <PageTitle
        breadCrumbItems={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Update Leave List', path: '/dashboard/update-leave-list' },
          { label: 'Add Holiday', path: '/dashboard/update-leave-list/holidays/create', active: true },
        ]}
        title="Add Holiday"
      />

      <div className="card mt-6">
        <div className="p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Add New Holiday</h3>
          
          {/* Form Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setFormTab('single')}
              className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                formTab === 'single'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Single Holiday
            </button>
            <button
              onClick={() => setFormTab('bulk')}
              className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                formTab === 'bulk'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Bulk Holiday Entry
            </button>
          </div>

          {formTab === 'single' ? (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="relative">
                      <input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                        placeholder="dd-mm-yyyy"
                      />
                      <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Team/Country */}
                  <div>
                    <label htmlFor="country_code" className="block text-sm font-medium text-gray-700 mb-2">
                      Team/Country <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="country_code"
                      value={formData.country_code || ''}
                      onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                    >
                      <option value="">All Teams (Organization Holiday)</option>
                      <option value="IN">IN (India)</option>
                      <option value="US">US (United States)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Select which team(s) this holiday applies to</p>
                  </div>

                  {/* Recurring Holiday */}
                  <div className="flex items-center pt-8">
                    <input
                      id="is_recurring"
                      type="checkbox"
                      checked={formData.is_recurring}
                      onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_recurring" className="ml-2 text-sm text-gray-700">
                      Recurring Holiday (every year)
                    </label>
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
                    {loading ? 'Creating...' : 'Create Holiday'}
                  </button>
                </div>
              </form>
            </>
              ) : (
                <form onSubmit={handleCreateBulkHolidays} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    {bulkHolidays.map((holiday, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-b border-gray-200 pb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Holiday Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={holiday.name}
                            onChange={(e) => {
                              const updated = [...bulkHolidays];
                              updated[index] = { ...updated[index], name: e.target.value };
                              setBulkHolidays(updated);
                            }}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                            placeholder="e.g., New Year"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Holiday Date <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              value={holiday.date}
                              onChange={(e) => {
                                const updated = [...bulkHolidays];
                                updated[index] = { ...updated[index], date: e.target.value };
                                setBulkHolidays(updated);
                              }}
                              required
                              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                            />
                            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Team/Country
                          </label>
                          <select
                            value={holiday.country_code || ''}
                            onChange={(e) => {
                              const updated = [...bulkHolidays];
                              updated[index] = { ...updated[index], country_code: e.target.value };
                              setBulkHolidays(updated);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                          >
                            <option value="">All Teams</option>
                            <option value="IN">IN (India)</option>
                            <option value="US">US (United States)</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          {bulkHolidays.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (bulkHolidays.length > 1) {
                                  setBulkHolidays(bulkHolidays.filter((_, i) => i !== index));
                                }
                              }}
                              className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                          {index === bulkHolidays.length - 1 && (
                            <button
                              type="button"
                              onClick={() => setBulkHolidays([...bulkHolidays, { name: '', date: '', country_code: '' }])}
                              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              Add Row
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
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
                      disabled={creatingBulk}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingBulk ? 'Creating...' : 'Create Holidays'}
                    </button>
                  </div>
                </form>
              )}
        </div>
      </div>
    </div>
  );
}


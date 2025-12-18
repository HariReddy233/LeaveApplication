'use client';

import classNames from 'classnames';
import { Clock, CheckCircle, XCircle, FileText } from 'lucide-react';

type SummaryItem = {
  _id: string;
  count: number;
};

type StatisticsProps = {
  totalLeave: number;
  summaryLists: SummaryItem[];
};

/**
 * Statistics Component - Matches HR Portal
 */
export default function Statistics({ totalLeave, summaryLists }: StatisticsProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
        {/* Total Leave Card */}
        <div className="p-6 text-center">
          <FileText className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <h3 className="text-2xl font-semibold text-gray-900 mb-1">
            {totalLeave || 0}
          </h3>
          <p className="text-sm text-gray-600 mb-0">Total Leave</p>
        </div>

        {/* Status Cards */}
        {summaryLists?.map((summary, index) => {
          const isPending = summary._id === 'Pending';
          const isApproved = summary._id === 'Approved';
          const isRejected = summary._id === 'Rejected';

          return (
            <div
              key={summary._id || index}
              className={`p-6 text-center ${
                index > 0 ? 'border-l border-gray-200' : ''
              }`}
            >
              {isPending && <Clock className="w-6 h-6 text-yellow-500 mx-auto mb-2" />}
              {isApproved && <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />}
              {isRejected && <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />}
              
              <h3 className="text-2xl font-semibold text-gray-900 mb-1 flex items-center justify-center gap-1">
                <span>{summary.count || 0}</span>
                <span
                  className={classNames('text-xs', {
                    'text-yellow-600': isPending,
                    'text-green-600': isApproved,
                    'text-red-600': isRejected,
                  })}
                >
                  ↑
                </span>
              </h3>
              <p className="text-sm text-gray-600 mb-0">{summary._id} Leave</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}











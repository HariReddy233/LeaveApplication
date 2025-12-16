'use client';

import Link from 'next/link';

type BreadcrumbItem = {
  label: string;
  path: string;
  active?: boolean;
};

type PageTitleProps = {
  breadCrumbItems: BreadcrumbItem[];
  title: string;
};

/**
 * PageTitle Component - Matches HR Portal
 * Displays breadcrumbs and page title
 */
export default function PageTitle({ breadCrumbItems, title }: PageTitleProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link href="/dashboard" className="hover:text-gray-900">
            Dashboard
          </Link>
          {breadCrumbItems.map((item, index) => (
            <span key={index} className="flex items-center">
              <span className="mx-2">/</span>
              {item.active ? (
                <span className="text-gray-900 font-medium">{item.label}</span>
              ) : (
                <Link href={item.path} className="hover:text-gray-900">
                  {item.label}
                </Link>
              )}
            </span>
          ))}
        </div>
      </div>
      <h4 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {title}
      </h4>
    </div>
  );
}







'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import classNames from 'classnames';
import { getMenuItems, MenuItem } from '@/utils/menu';

type MenuProps = {
  userRole?: string;
};

export default function Menu({ userRole }: MenuProps) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  
  // Memoize menuItems to prevent infinite loop
  const menuItems = useMemo(() => getMenuItems(userRole), [userRole]);

  useEffect(() => {
    // Auto-open menu if current path matches a child
    const findActiveMenu = (items: MenuItem[]): string[] => {
      const activeKeys: string[] = [];
      items.forEach((item) => {
        if (item.children) {
          const hasActiveChild = item.children.some(
            (child) => child.url === pathname
          );
          if (hasActiveChild) {
            activeKeys.push(item.key);
          }
        } else if (item.url === pathname) {
          activeKeys.push(item.key);
        }
      });
      return activeKeys;
    };
    
    const newActiveKeys = findActiveMenu(menuItems);
    
    // Only update state if the active keys actually changed
    setOpenMenus((prev) => {
      const prevStr = prev.sort().join(',');
      const newStr = newActiveKeys.sort().join(',');
      if (prevStr !== newStr) {
        return newActiveKeys;
      }
      return prev;
    });
  }, [pathname, menuItems]);

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    if (item.isTitle) {
      return (
        <li key={item.key} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {item.label}
        </li>
      );
    }

    if (item.children && item.children.length > 0) {
      const isOpen = openMenus.includes(item.key);
      // Check if any child is active
      const hasActiveChild = item.children.some(
        (child) => child.url === pathname
      );
      return (
        <li key={item.key}>
          <button
            onClick={() => toggleMenu(item.key)}
            className={classNames(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-sm font-medium',
              {
                'bg-blue-600 text-white': hasActiveChild,
                'text-gray-700 hover:bg-gray-100': !hasActiveChild,
              }
            )}
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            <div className="flex items-center gap-3">
              <span className={hasActiveChild ? 'text-white' : 'text-gray-500'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
            {isOpen ? (
              <ChevronDown className={`w-4 h-4 ${hasActiveChild ? 'text-white' : 'text-gray-500'}`} />
            ) : (
              <ChevronRight className={`w-4 h-4 ${hasActiveChild ? 'text-white' : 'text-gray-500'}`} />
            )}
          </button>
          {isOpen && (
            <ul className="ml-4 mt-1 space-y-1">
              {item.children.map((child) => renderMenuItem(child, level + 1))}
            </ul>
          )}
        </li>
      );
    }

    // For Dashboard, only highlight if pathname is exactly /dashboard
    // For other items, check exact match
    let isActive = false;
    if (item.url === '/dashboard') {
      isActive = pathname === '/dashboard';
    } else {
      isActive = pathname === item.url;
    }
    
    return (
      <li key={item.key}>
        <Link
          href={item.url || '#'}
          className={classNames(
            'flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm font-medium',
            {
              'bg-blue-600 text-white': isActive,
              'text-gray-700 hover:bg-gray-100': !isActive,
            }
          )}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {item.icon && (
            <span className={`mr-3 ${isActive ? 'text-white' : 'text-gray-500'}`}>
              {item.icon}
            </span>
          )}
          <span>{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <ul className="space-y-1">
      {menuItems.map((item) => renderMenuItem(item))}
    </ul>
  );
}


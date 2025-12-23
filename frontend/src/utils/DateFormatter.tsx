// DateFormatter - Matches HR Portal
'use client';

import React from 'react';

type DateFormatterProps = {
  date: string | Date | null | undefined;
};

const DateFormatter: React.FC<DateFormatterProps> = ({ date }) => {
  if (!date) {
    return <span>N/A</span>;
  }
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return <span>N/A</span>;
    }
    
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()] || 'Jan';
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    return (
      <span>
        {day} {month} {year}
      </span>
    );
  } catch (error) {
    console.error('DateFormatter error:', error, date);
    return <span>N/A</span>;
  }
};

// Also export as a function for backward compatibility
export function formatDate(date: string | Date | null | undefined) {
  if (!date) return 'N/A';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    return `${day} ${month} ${year}`;
  } catch (error) {
    return 'N/A';
  }
}

export default DateFormatter;



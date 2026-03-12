import { v4 as uuidv4 } from 'uuid';

const pad = (value) => String(value).padStart(2, '0');

const toICSDate = (date) => (
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
);

const toICSDateTime = (date) => (
  date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
);

const toText = (value) => String(value || '').replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\r?\n/g, '\\n');

const toCommonName = (value) => String(value || 'Employee').replace(/[;,:]/g, ' ').trim();

const parseDate = (value) => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  return new Date(value);
};

export const generateLeaveICS = ({
  employeeName,
  employeeEmail,
  leaveType,
  startDate,
  endDate,
  approvedOn,
  organizerEmail,
}) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const approved = parseDate(approvedOn || new Date());

  const endPlusOne = new Date(end.getTime());
  endPlusOne.setDate(endPlusOne.getDate() + 1);

  const uid = `${uuidv4()}@leave-management`;
  const dtstamp = toICSDateTime(new Date());
  const dtstart = toICSDate(start);
  const dtend = toICSDate(endPlusOne);

  const summary = `[On Leave] ${employeeName} - ${leaveType}`;
  const description = `Leave approved.\\nType: ${leaveType}\\nFrom: ${start.toDateString()}\\nTo: ${end.toDateString()}\\nApproved on: ${approved.toDateString()}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Leave Management System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${toText(summary)}`,
    `DESCRIPTION:${toText(description)}`,
    `ORGANIZER;CN=Leave Management:mailto:${organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${toCommonName(employeeName)}:mailto:${employeeEmail}`,
    'TRANSP:TRANSPARENT',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'X-MICROSOFT-CDO-BUSYSTATUS:OOF',
    'X-MICROSOFT-CDO-ALLDAYEVENT:TRUE',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
};
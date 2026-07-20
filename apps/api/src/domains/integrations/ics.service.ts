/**
 * Generate RFC 5545 .ics calendar files so booking confirmations can be
 * one-click added to Google Calendar, Outlook, Apple Calendar, etc.
 */

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string; // Zoom join URL
  startsAt: Date;
  endsAt: Date;
  organizerEmail?: string;
  attendeeEmails?: string[];
}

function fmtDateUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function generateIcs(event: IcsEvent): string {
  const now = fmtDateUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Referral Nova//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}@virtualprosnetwork.app`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmtDateUtc(event.startsAt)}`,
    `DTEND:${fmtDateUtc(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.organizerEmail) {
    lines.push(`ORGANIZER:mailto:${event.organizerEmail}`);
  }
  for (const att of event.attendeeEmails ?? []) {
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${att}`);
  }
  lines.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

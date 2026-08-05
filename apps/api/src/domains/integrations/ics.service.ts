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
  // REQUEST = invite/update (RSVP), PUBLISH = informational (no update prompt),
  // CANCEL = removal. STATUS mirrors it.
  method?: 'REQUEST' | 'CANCEL' | 'PUBLISH';
  // Must strictly increase across versions of the same UID for calendar
  // clients to accept an update/cancel over the original invite.
  sequence?: number;
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
  const method = event.method ?? 'REQUEST';
  const status = method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';
  const sequence = event.sequence ?? 0;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Referral Nova//Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}@referralnova.com`,
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
  lines.push(`STATUS:${status}`, `SEQUENCE:${sequence}`, 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

// Xuất nhắc nhở thành file lịch .ics (RFC 5545) để thêm vào Google Calendar hoặc lịch iPhone.

import { jdToDate } from './calendar.js';

const CRLF = '\r\n';
const utf8 = new TextEncoder();
const pad = (n) => String(n).padStart(2, '0');

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Asia/Ho_Chi_Minh',
  'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:+07', 'END:STANDARD',
  'END:VTIMEZONE',
];

const escape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Gấp dòng dài quá 75 byte, không cắt giữa ký tự UTF-8
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const n = utf8.encode(ch).length;
    if (bytes + n > 75) { out.push(cur); cur = ' ' + ch; bytes = 1 + n; }
    else { cur += ch; bytes += n; }
  }
  out.push(cur);
  return out.join(CRLF);
}

const localTime = (jdn, hour, minute) => {
  const { d, m, y } = jdToDate(jdn);
  return `${y}${pad(m)}${pad(d)}T${pad(hour + Math.floor(minute / 60))}${pad(minute % 60)}00`;
};

// events: [{ jdn, hour, minute, title, description }]
export function toICS({ calName, uidPrefix, events, now = new Date() }) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lich Thong Thu//Nhac phong thuy//VI',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escape(calName)}`, 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
    ...VTIMEZONE,
  ];
  for (const ev of events) {
    const { d, m, y } = jdToDate(ev.jdn);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uidPrefix}-${y}${pad(m)}${pad(d)}@lich-thong-thu`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Ho_Chi_Minh:${localTime(ev.jdn, ev.hour, ev.minute)}`,
      `DTEND;TZID=Asia/Ho_Chi_Minh:${localTime(ev.jdn, ev.hour, ev.minute + 15)}`,
      `SUMMARY:${escape(ev.title)}`,
      `DESCRIPTION:${escape(ev.description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escape(ev.title)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join(CRLF) + CRLF;
}

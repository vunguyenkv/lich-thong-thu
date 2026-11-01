import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jdFromDate } from '../src/calendar.js';
import { computeProfile } from '../src/stars.js';
import { buildReminders } from '../src/reminders.js';
import { toICS } from '../src/ics.js';

const vu = computeProfile({ name: 'Nguyễn Đình Vũ', y: 1988, m: 5, d: 5, hh: 8, mi: 30 });
const events = buildReminders(vu, jdFromDate(1, 1, 2027), jdFromDate(31, 12, 2027));
const ics = toICS({ calName: 'Nhắc phong thủy · Nguyễn Đình Vũ', uidPrefix: 'vu-19880505', events, now: new Date('2026-10-28T00:00:00Z') });
const lines = ics.split('\r\n');

test('đúng khung VCALENDAR, dòng kết thúc bằng CRLF', () => {
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(lines.every((l) => !l.includes('\n')));
});

test('mỗi dòng không quá 75 byte và không cắt đôi ký tự tiếng Việt', () => {
  const enc = new TextEncoder();
  assert.ok(lines.every((l) => enc.encode(l).length <= 75));
  const unfolded = ics.replace(/\r\n /g, '');
  assert.match(unfolded, /SUMMARY:★ Hôm nay Ngọc Đường tối ưu/);
});

test('mỗi nhắc nhở là một sự kiện 7h sáng có báo thức', () => {
  assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, events.length);
  assert.equal(lines.filter((l) => l === 'BEGIN:VALARM').length, events.length);
  const starts = lines.filter((l) => l.startsWith('DTSTART;TZID='));
  assert.equal(starts.length, events.length);
  assert.ok(starts.every((l) => l.endsWith('T070000')));
});

test('UID ổn định để nhập lại không bị trùng', () => {
  const again = toICS({ calName: 'x', uidPrefix: 'vu-19880505', events, now: new Date() });
  const uids = (s) => s.split('\r\n').filter((l) => l.startsWith('UID:'));
  assert.deepEqual(uids(again), uids(ics));
  assert.equal(new Set(uids(ics)).size, events.length);
});

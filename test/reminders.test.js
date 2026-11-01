import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jdFromISO, jdFromDate, isoDate } from '../src/calendar.js';
import { computeProfile } from '../src/stars.js';
import { buildReminders } from '../src/reminders.js';

const vu = computeProfile({ name: 'Nguyễn Đình Vũ', y: 1988, m: 5, d: 5, hh: 8, mi: 30 });
const byDate = (events) => Object.fromEntries(events.map((e) => [isoDate(e.jdn), e]));

test('ngày tối ưu được nhắc đúng ngày và báo trước 3 ngày', () => {
  const ev = byDate(buildReminders(vu, jdFromISO('2026-03-01'), jdFromISO('2026-03-31')));
  assert.ok(ev['2026-03-22'].kinds.includes('toiUu'));            // Ất Mùi: Ngọc Đường tối ưu
  assert.match(ev['2026-03-22'].title, /Ngọc Đường tối ưu/);
  assert.ok(ev['2026-03-19'].kinds.includes('sapToi'));
  assert.match(ev['2026-03-19'].title, /Còn 3 ngày/);
});

test('ngày tối ưu rơi vào Nguyệt phá thì không nhắc tốt, chỉ cảnh báo', () => {
  const ev = byDate(buildReminders(vu, jdFromISO('2026-01-15'), jdFromISO('2026-01-25')));
  assert.deepEqual(ev['2026-01-21'].kinds, ['xau']);                 // Ất Mùi nhưng Nguyệt phá
  assert.equal(ev['2026-01-18'], undefined);
});

test('đầu tháng và đầu năm', () => {
  const ev = byDate(buildReminders(vu, jdFromISO('2026-02-01'), jdFromISO('2026-03-10')));
  assert.ok(ev['2026-02-04'].kinds.includes('thang'));
  assert.match(ev['2026-02-04'].title, /Năm mới Bính Ngọ/);
  assert.match(ev['2026-02-04'].description, /Thái Tuế: Nam \(Ngọ\)/);
  assert.match(ev['2026-03-05'].title, /Sang tháng Tân Mão/);
});

test('năm 2027: 50 ngày tối ưu, khoảng 3 tin mỗi tuần', () => {
  const events = buildReminders(vu, jdFromDate(1, 1, 2027), jdFromDate(31, 12, 2027));
  assert.equal(events.filter((e) => e.kinds.includes('toiUu')).length, 50);
  const perWeek = events.length / 52;
  assert.ok(perWeek > 2 && perWeek < 4, `${perWeek.toFixed(1)} tin/tuần`);
});

test('tắt từng loại nhắc', () => {
  const events = buildReminders(vu, jdFromDate(1, 1, 2027), jdFromDate(31, 12, 2027), { badDays: false, leadDays: 0 });
  assert.ok(events.every((e) => !e.kinds.includes('xau') && !e.kinds.includes('sapToi')));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeZip } from '../src/zip.js';
import { dayAdvice } from '../src/advice.js';
import { computeProfile } from '../src/stars.js';
import { jdFromISO } from '../src/calendar.js';

test('file zip có đúng chữ ký, số file và giữ nguyên nội dung tiếng Việt', () => {
  const zip = makeZip([{ name: 'nhắc.ics', text: 'Ngọc Đường tối ưu' }]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 1);
  assert.ok(new TextDecoder().decode(zip).includes('Ngọc Đường tối ưu'));
});

const vu = computeProfile({ name: 'Nguyễn Đình Vũ', y: 1988, m: 5, d: 5, hh: 8, mi: 30 });
const verdict = (iso) => dayAdvice(vu, jdFromISO(iso)).verdict;

test('đánh giá ngày theo lá số', () => {
  assert.equal(verdict('2026-03-22'), 'toiUu');    // Ất Mùi, Ngọc Đường tối ưu, trực Định
  assert.equal(verdict('2026-01-21'), 'xau');      // Ất Mùi nhưng Nguyệt phá
  assert.equal(verdict('2026-03-15'), 'canThan');  // Mậu Tý, Tuế phá
  // Bính Tý vừa Tuế phá vừa Tam Thai tối ưu: xếp tối ưu nhưng vẫn ghi cảnh báo
  const both = dayAdvice(vu, jdFromISO('2026-03-03'));
  assert.equal(both.verdict, 'toiUu');
  assert.ok(both.avoid.some((t) => t.startsWith('Tuế phá')));
  assert.deepEqual(dayAdvice(vu, jdFromISO('2026-01-21')).doList, []);
});

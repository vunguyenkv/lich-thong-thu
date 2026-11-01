import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jdFromISO, gzName } from '../src/calendar.js';
import { dayInfo } from '../src/day.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/lunar-2026-2027.json', import.meta.url)));

test('can chi, trực, Nguyệt phá, Tuế phá khớp lunar_python cho 730 ngày 2026–2027', () => {
  const wrong = [];
  for (const [iso, ngay, truc, nguyetPha, tuePha] of fixture.rows) {
    const info = dayInfo(jdFromISO(iso));
    const got = [gzName(info.di), info.truc, +info.nguyetPha, +info.tuePha];
    if (JSON.stringify(got) !== JSON.stringify([ngay, truc, nguyetPha, tuePha])) wrong.push(iso);
  }
  assert.deepEqual(wrong, []);
});

test('ngày âm lịch khớp lunar_python cho 730 ngày 2026–2027', () => {
  const wrong = [];
  for (const [iso, , , , , amNgay, amThang, nhuan] of fixture.rows) {
    const { lunar } = dayInfo(jdFromISO(iso));
    if (lunar.day !== amNgay || lunar.month !== amThang || +lunar.leap !== nhuan) wrong.push(iso);
  }
  assert.deepEqual(wrong, []);
});

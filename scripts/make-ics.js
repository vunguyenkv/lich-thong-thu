// Tạo file lịch nhắc nhở (.ics) cho từng người trong danh sách.
// Dùng: node scripts/make-ics.js [danh-sach.csv] [--from 2026-11-01] [--to 2027-12-31] [--out out]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { jdFromDate, jdFromISO, fmtDate, gzName } from '../src/calendar.js';
import { parsePeople, slugify } from '../src/people.js';
import { computeProfile } from '../src/stars.js';
import { buildReminders } from '../src/reminders.js';
import { toICS } from '../src/ics.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { from: { type: 'string' }, to: { type: 'string' }, out: { type: 'string', default: 'out' } },
});
const file = positionals[0] ?? 'data/khach-mau.csv';
const today = new Date();
const from = values.from ? jdFromISO(values.from) : jdFromDate(today.getDate(), today.getMonth() + 1, today.getFullYear());
const to = values.to ? jdFromISO(values.to) : jdFromDate(31, 12, today.getFullYear() + 1);
const pad = (n) => String(n).padStart(2, '0');

const { people, errors } = parsePeople(readFileSync(file, 'utf8'));
for (const e of errors) console.error(`Dòng ${e.line}: ${e.message}`);
mkdirSync(values.out, { recursive: true });
console.log(`Nhắc nhở từ ${fmtDate(from)} đến ${fmtDate(to)}\n`);

for (const person of people) {
  const profile = computeProfile(person);
  const events = buildReminders(profile, from, to);
  const id = `${slugify(person.name)}-${person.y}${pad(person.m)}${pad(person.d)}`;
  const path = `${values.out}/${id}.ics`;
  writeFileSync(path, toICS({ calName: `Nhắc phong thủy · ${person.name}`, uidPrefix: id, events }));
  const n = (k) => events.filter((e) => e.kinds.includes(k)).length;
  console.log(`${person.name} (ngày ${gzName(profile.day)}): ${events.length} tin`
    + ` · tối ưu ${n('toiUu')} · báo trước ${n('sapToi')} · ngày xấu ${n('xau')} · đầu tháng ${n('thang')}\n  → ${path}`);
}
if (errors.length) process.exitCode = 1;

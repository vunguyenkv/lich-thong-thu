// Đọc danh sách người từ CSV hoặc dữ liệu dán từ Excel (cách nhau bằng tab).
// Cột: Tên, Ngày sinh, Giờ sinh, Giới tính, Email. Dòng tiêu đề có thể có hoặc không.

import { jdFromDate, jdToDate } from './calendar.js';

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
export const slugify = (s) => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'khach';

const FIELDS = {
  name: ['ten', 'ho ten', 'ho va ten', 'name'],
  date: ['ngay sinh', 'ngay', 'dob', 'birthday'],
  time: ['gio sinh', 'gio', 'time'],
  gender: ['gioi tinh', 'gioi', 'phai', 'gender'],
  email: ['email', 'e-mail', 'mail'],
};
const DEFAULT_COLS = ['name', 'date', 'time', 'gender', 'email'];

export function parseDate(s = '') {
  let d, m, y, x;
  if ((x = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = [x[1], x[2], x[3]].map(Number);
  else if ((x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, m, d] = [x[1], x[2], x[3]].map(Number);
  else return null;
  const back = jdToDate(jdFromDate(d, m, y));
  return back.d === d && back.m === m && back.y === y && y >= 1900 && y <= 2100 ? { d, m, y } : null;
}

export function parseTime(s = '') {
  const x = s.match(/^(\d{1,2})(?:[:hH](\d{2})?)?$/);
  if (!x) return null;
  const hh = Number(x[1]), mi = Number(x[2] ?? 0);
  return hh < 24 && mi < 60 ? { hh, mi } : null;
}

export function parseGender(s = '') {
  const g = strip(s).toLowerCase();
  if (['nam', 'male', 'm', 'trai'].includes(g)) return 'nam';
  if (['nu', 'female', 'f', 'gai'].includes(g)) return 'nu';
  return '';
}

export function parsePeople(text) {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const people = [], errors = [];
  if (!rows.length) return { people, errors };
  const delim = rows[0].includes('\t') ? '\t' : rows[0].split(';').length > rows[0].split(',').length ? ';' : ',';
  const split = (l) => l.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));

  let cols = DEFAULT_COLS, start = 0;
  const head = split(rows[0]).map((c) => strip(c).toLowerCase());
  if (head.some((h) => FIELDS.name.includes(h) || FIELDS.date.includes(h))) {
    cols = head.map((h) => Object.keys(FIELDS).find((f) => FIELDS[f].includes(h)) ?? null);
    start = 1;
  }

  rows.slice(start).forEach((line, i) => {
    const lineNo = i + start + 1, cells = split(line), rec = {};
    cols.forEach((c, k) => { if (c && cells[k]) rec[c] = cells[k]; });
    if (!rec.name) return errors.push({ line: lineNo, message: 'Thiếu tên.' });
    const date = parseDate(rec.date);
    if (!date) return errors.push({ line: lineNo, message: `Ngày sinh "${rec.date ?? ''}" không đọc được. Dùng dạng 05/05/1988.` });
    const time = rec.time ? parseTime(rec.time) : null;
    if (rec.time && !time) return errors.push({ line: lineNo, message: `Giờ sinh "${rec.time}" không đọc được. Dùng dạng 08:30, hoặc để trống.` });
    people.push({
      name: rec.name, ...date, ...(time ?? {}),
      time: time ? `${String(time.hh).padStart(2, '0')}:${String(time.mi).padStart(2, '0')}` : '',
      gender: parseGender(rec.gender), email: rec.email ?? '',
    });
  });
  return { people, errors };
}

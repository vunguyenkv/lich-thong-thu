import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePeople, slugify } from '../src/people.js';

test('đọc CSV có dòng tiêu đề', () => {
  const { people, errors } = parsePeople('Tên,Ngày sinh,Giờ sinh,Giới tính\nNguyễn Đình Vũ,05/05/1988,08:30,Nam\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(people[0], { name: 'Nguyễn Đình Vũ', d: 5, m: 5, y: 1988, hh: 8, mi: 30, time: '08:30', gender: 'nam', email: '' });
});

test('đọc dữ liệu dán từ Excel (tab, không tiêu đề, giờ dạng 8h30)', () => {
  const { people } = parsePeople('Nguyễn Đình Vũ\t5/5/1988\t8h30\tnam\nĐỗ Kim Ngân\t27/9/1988\t\t\n');
  assert.equal(people.length, 2);
  assert.equal(people[0].time, '08:30');
  assert.equal(people[1].time, '');
  assert.equal(people[1].gender, '');
});

test('báo lỗi dòng sai, vẫn đọc các dòng đúng', () => {
  const { people, errors } = parsePeople('Tên,Ngày sinh\nA,31/02/1990\nB,1990-02-28\n,01/01/1990\n');
  assert.equal(people.length, 1);
  assert.deepEqual(errors.map((e) => e.line), [2, 4]);
});

test('tên file không dấu', () => {
  assert.equal(slugify('Đỗ Kim Ngân'), 'do-kim-ngan');
});

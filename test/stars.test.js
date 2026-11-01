import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProfile, starLabel } from '../src/stars.js';
import { gzName } from '../src/calendar.js';

// Thứ tự: Quốc Ấn, Ngọc Đường, Long Đức, Kim Quỹ, Dịch Mã, Học Đường, Quý Nhân,
//         Tam Thai, Bát Toạ, Địa Giải, Giải Thần, Thiên Y, Thiên Hỷ, Đào Hoa
const CARDS = [
  {
    person: { name: 'Nguyễn Đình Vũ', y: 1988, m: 5, d: 5, hh: 8, mi: 30 },
    printed: ['Tất cả Thìn', 'Ất Mùi', 'Tất cả Mão', 'Giáp Tý', 'Tất cả Dần', 'Kỷ Tỵ', 'Tất cả Sửu, Mùi',
      'Bính Tý', 'Nhâm Dần', 'Quý Hợi', 'Canh Dần', 'Kỷ Mùi', 'Quý Sửu', 'Tất cả Dậu'],
  },
  {
    person: { name: 'Đỗ Kim Ngân', y: 1988, m: 9, d: 27 },
    printed: ['Tất cả Hợi', 'Mậu Tý', 'Tất cả Thìn', 'Kỷ Dậu', 'Tất cả Hợi', 'Nhâm Ngọ', 'Tất cả Tý, Thân',
      'Tân Sửu', 'Đinh Sửu', 'Đinh Hợi', 'Ất Sửu', 'Nhâm Thân', 'Bính Tý', 'Tất cả Ngọ'],
  },
];

test('14 sao khớp đủ 28 ô trên 2 thẻ in', () => {
  for (const { person, printed } of CARDS) {
    assert.deepEqual(computeProfile(person).stars.map(starLabel), printed, person.name);
  }
});

test('tứ trụ của Nguyễn Đình Vũ: sinh trước giờ Lập Hạ nên tháng Bính Thìn', () => {
  const p = computeProfile(CARDS[0].person);
  assert.deepEqual([p.year, p.month, p.day, p.hour].map(gzName), ['Mậu Thìn', 'Bính Thìn', 'Canh Thân', 'Canh Thìn']);
  assert.equal(p.tuoi, 4);   // tuổi Thìn
});

test('sinh từ 23h tính sang ngày hôm sau', () => {
  const before = computeProfile({ y: 1988, m: 5, d: 5, hh: 22, mi: 59 });
  const after = computeProfile({ y: 1988, m: 5, d: 5, hh: 23, mi: 0 });
  assert.equal(gzName(before.day), 'Canh Thân');
  assert.equal(gzName(after.day), 'Tân Dậu');
});

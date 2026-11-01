// Đối chiếu với những gì in trên lịch BAZI TEAM 2026 (ảnh IMG_0780–0813).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jdFromISO, jdFromDate } from '../src/calendar.js';
import { dayInfo, TRUC, TRUC_Y, TRUC_TOT } from '../src/day.js';
import { chart, yearCenter, monthCenter, yearAfflictions, monthFengShui, assessPalace, palaceAt, mountainAt, palaceRange } from '../src/flyingstars.js';

const truc = (iso) => TRUC[dayInfo(jdFromISO(iso)).truc];

test('ngày giao tiết lặp lại trực của hôm trước', () => {
  for (const [a, b, name] of [['2026-02-03', '2026-02-04', 'Nguy'], ['2026-04-04', '2026-04-05', 'Chấp'],
    ['2026-11-06', '2026-11-07', 'Khai'], ['2026-12-06', '2026-12-07', 'Bình']]) {
    assert.equal(truc(a), name, a);
    assert.equal(truc(b), name, b);
  }
});

test('nhãn Nguyệt phá và Tuế phá trên lịch in', () => {
  for (const iso of ['2026-01-09', '2026-02-02', '2026-11-15', '2026-11-27']) assert.ok(dayInfo(jdFromISO(iso)).nguyetPha, iso);
  // 1/1/2026 vẫn thuộc năm Ất Tỵ nên ngày Hợi là Tuế phá; từ Lập Xuân 4/2 là năm Bính Ngọ
  for (const iso of ['2026-01-01', '2026-02-07', '2026-03-03']) assert.ok(dayInfo(jdFromISO(iso)).tuePha, iso);
});

test('phi tinh năm 2026 giống trang "Phi tinh năm 2026"', () => {
  assert.equal(yearCenter(2026), 1);
  assert.deepEqual(chart(1), { C: 1, TB: 2, T: 3, ĐB: 4, N: 5, B: 6, TN: 7, Đ: 8, ĐN: 9 });
});

test('sao trung cung của 12 tháng 2026 giống ô phi tinh in trên từng trang', () => {
  const printed = [9, 8, 7, 6, 5, 4, 3, 2, 1, 9, 8, 7];
  const got = printed.map((_, i) => {
    const info = dayInfo(jdFromDate(15, i + 1, 2026));
    return monthCenter(info.year, info.monthBranch);
  });
  assert.deepEqual(got, printed);
});

test('hướng Thái Tuế, Tuế Phá, Tam Sát, Ngũ Hoàng năm 2026', () => {
  const a = Object.fromEntries(yearAfflictions(2026).map((x) => [x.key, `${x.where} ${x.deg}`]));
  assert.equal(a.thaiTue, 'Nam (Ngọ) 172.5°–187.5°');
  assert.equal(a.tuePha, 'Bắc (Tý) 352.5°–7.5°');
  assert.equal(a.tamSat, 'Bắc (Nhâm Tý Quý) 337.5°–22.5°');
  assert.equal(a.nguHoang, 'Nam 157.5°–202.5°');
});

test('tháng Kỷ Sửu (5/1–3/2/2026): khu vực tốt và tránh trùng với trang phong thủy', () => {
  const fs = monthFengShui(2025, 1);
  const keys = (list) => list.map((p) => p.key).sort();
  for (const k of ['ĐN', 'N', 'TN']) assert.ok(keys(fs.tot).includes(k), `tốt: ${k}`);
  for (const k of ['B', 'ĐB', 'T']) assert.ok(keys(fs.tranh).includes(k), `tránh: ${k}`);
});

test('sao 8 và 9 cùng cung: không lặp chữ tài lộc', () => {
  assert.deepEqual(assessPalace(8, 9).themes, ['tài lộc', 'hỷ sự']);
  assert.deepEqual(assessPalace(9, 8).themes, ['tài lộc', 'hỷ sự']);
});

test('mỗi trực có một câu nghĩa; trực đỏ không ghi kỵ việc lớn', () => {
  assert.equal(TRUC_Y.length, 12);
  assert.ok(TRUC_Y.every((t) => t.length > 0));
  assert.match(TRUC_Y[TRUC.indexOf('Phá')], /kỵ mọi việc lớn/);
  for (const i of TRUC_TOT) assert.doesNotMatch(TRUC_Y[i], /kỵ (mọi việc lớn|khởi sự)/);
});

test('năm Bính Ngọ: hướng xấu nằm đúng cung trên bảng 9 ô', () => {
  const at = Object.fromEntries(yearAfflictions(2026).map((x) => [x.key, x.palace]));
  assert.deepEqual(at, { thaiTue: 'N', tuePha: 'B', tamSat: 'B', nguHoang: 'N' });
});

test('tháng Canh Dần 2026: bảng 9 ô khớp trang phong thủy in', () => {
  const fs = monthFengShui(2026, 2);
  const order = ['ĐN', 'N', 'TN', 'Đ', 'C', 'T', 'ĐB', 'B', 'TB'];
  assert.deepEqual(order.map((k) => fs.yearChart[k]), [9, 5, 7, 8, 1, 3, 4, 6, 2]);
  assert.deepEqual(order.map((k) => fs.monthChart[k]), [7, 3, 5, 6, 8, 1, 2, 4, 9]);
});

// Đọc từ 12 trang phong thủy in: [năm, chi tháng, tốt, tránh, học tốt, học kém, duyên tốt, duyên dễ va chạm]
const TRANG_IN = [
  ['Kỷ Sửu 05/1', 2025, 1, 'ĐN N TN', 'N T B ĐB', 'TB', '', 'Đ', ''],
  ['Canh Dần 04/2', 2026, 2, 'TB B Đ', 'N TN B ĐB', 'T', '', 'ĐN', ''],
  ['Tân Mão 05/3', 2026, 3, 'T TB', 'ĐN N TN B Đ', 'ĐB', 'N', 'TN', ''],
  ['Nhâm Thìn 05/4', 2026, 4, 'T Đ', 'ĐN N TN TB', 'B Đ', '', 'ĐB', ''],
  ['Quý Tỵ 05/5', 2026, 5, 'ĐN Đ', 'T N', 'B ĐB', '', '', 'TN TB'],
  ['Giáp Ngọ 05/6', 2026, 6, 'ĐN TN Đ', 'N T TB B ĐB', '', 'N', 'ĐN TN', ''],
  ['Ất Mùi 07/7', 2026, 7, 'B Đ', 'ĐN N TN TB', 'TB ĐB', '', 'TN', 'T'],
  ['Bính Thân 07/8', 2026, 8, 'ĐN Đ', 'N TB B ĐB', 'ĐN T', '', 'TN', ''],
  ['Đinh Dậu 07/9', 2026, 9, 'ĐN B Đ', 'N TN T TB', 'ĐB', '', 'ĐN ĐB', ''],
  ['Mậu Tuất 08/10', 2026, 10, 'ĐN Đ', 'N TN T TB B', 'ĐB', '', 'ĐN', 'TN T'],
  ['Kỷ Hợi 07/11', 2026, 11, 'TB B Đ', 'N TN B ĐB', 'T', '', 'ĐN', ''],
  ['Canh Tý 07/12', 2026, 0, 'T TB', 'ĐN N TN B Đ', 'ĐB', 'N', 'TN', ''],
];
const set = (t) => t.split(' ').filter(Boolean).sort();
const keysOf = (list) => list.map((p) => p.key).sort();

for (const [ten, y, mb, tot, tranh, hocTot, hocKem, duyenTot, duyenKem] of TRANG_IN) {
  test(`trang phong thủy ${ten}: tốt, tránh, học thuật, tình duyên khớp lịch in`, () => {
    const fs = monthFengShui(y, mb);
    assert.deepEqual(keysOf(fs.tot), set(tot), 'tốt');
    assert.deepEqual(keysOf(fs.tranh), set(tranh), 'tránh');
    assert.deepEqual(keysOf(fs.hoc.filter((p) => p.good)), set(hocTot), 'học thuật tốt');
    assert.deepEqual(keysOf(fs.hoc.filter((p) => !p.good)), set(hocKem), 'học thuật kém');
    assert.deepEqual(keysOf(fs.duyen.filter((p) => p.good)), set(duyenTot), 'tình duyên tốt');
    assert.deepEqual(keysOf(fs.duyen.filter((p) => !p.good)), set(duyenKem), 'tình duyên dễ va chạm');
    assert.ok(fs.palaces.every((p) => !p.inferred), 'năm 2026 không cung nào phải tự suy');
  });
}

test('năm 2027 sao năm 1 bay ra Tây Bắc: cặp lịch in chưa có thì tự suy và đánh dấu', () => {
  const fs = monthFengShui(2027, 2);
  const tb = fs.palaces.find((p) => p.key === 'TB');
  assert.equal(tb.stars[0], 1);
  assert.equal(tb.inferred, tb.stars[1] !== 8);
  assert.ok(fs.palaces.filter((p) => p.key !== 'TB').every((p) => !p.inferred));
});

test('lời giải thích: cặp 2-8 là nhà đất, cặp 6-4 cảnh giác lừa đảo', () => {
  const tot = monthFengShui(2026, 3).tot.find((p) => p.key === 'TB');        // Tân Mão, Tây Bắc 2-8
  assert.deepEqual(tot.themes, ['nhà đất', 'tài lộc']);
  const tranh = monthFengShui(2026, 2).tranh.find((p) => p.key === 'B');     // Canh Dần, Bắc 6-4
  assert.deepEqual(tranh.themes, ['lừa đảo, đầu tư']);
});

test('số độ la bàn ra phương vị và sơn', () => {
  const cases = { 0: 'B', 22.4: 'B', 22.5: 'ĐB', 90: 'Đ', 130: 'ĐN', 180: 'N', 225: 'TN', 270: 'T', 315: 'TB', 337.5: 'B', 359.9: 'B', 370: 'B', [-10]: 'B' };
  for (const [deg, key] of Object.entries(cases)) assert.equal(palaceAt(Number(deg)), key, `${deg}°`);
  assert.equal(mountainAt(130), 'Tốn');
  assert.equal(mountainAt(0), 'Tý');
  assert.equal(mountainAt(352.5), 'Tý');
  assert.equal(palaceRange('B'), '337.5°–22.5°');
  assert.equal(palaceRange('ĐN'), '112.5°–157.5°');
});

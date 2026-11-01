// Phi tinh Huyền Không năm và tháng, các hướng xấu của năm.
// Xếp tốt, tránh, học thuật, tình duyên theo bảng cặp sao rút ra từ 12 trang phong thủy lịch in 2026;
// lời giải thích ngắn là của mình, không chép văn của lịch.

import { mod, CHI, branchOfYear, monthPillar, gzName } from './calendar.js';

export const STAR_NAME = { 1: 'Nhất Bạch', 2: 'Nhị Hắc', 3: 'Tam Bích', 4: 'Tứ Lục', 5: 'Ngũ Hoàng', 6: 'Lục Bạch', 7: 'Thất Xích', 8: 'Bát Bạch', 9: 'Cửu Tử' };
// Thứ tự bay thuận từ trung cung: Tây Bắc, Tây, Đông Bắc, Nam, Bắc, Tây Nam, Đông, Đông Nam
const FLIGHT = ['C', 'TB', 'T', 'ĐB', 'N', 'B', 'TN', 'Đ', 'ĐN'];
export const PALACE = {
  B: { name: 'Bắc', deg: 0 }, ĐB: { name: 'Đông Bắc', deg: 45 }, Đ: { name: 'Đông', deg: 90 }, ĐN: { name: 'Đông Nam', deg: 135 },
  N: { name: 'Nam', deg: 180 }, TN: { name: 'Tây Nam', deg: 225 }, T: { name: 'Tây', deg: 270 }, TB: { name: 'Tây Bắc', deg: 315 },
};
// 24 sơn, mỗi sơn 15°, Tý ở 0°
export const MOUNTAINS = ['Tý', 'Quý', 'Sửu', 'Cấn', 'Dần', 'Giáp', 'Mão', 'Ất', 'Thìn', 'Tốn', 'Tỵ', 'Bính', 'Ngọ', 'Đinh', 'Mùi', 'Khôn', 'Thân', 'Canh', 'Dậu', 'Tân', 'Tuất', 'Càn', 'Hợi', 'Nhâm'];

const wrap9 = (n) => mod(n - 1, 9) + 1;
const fmtDeg = (x) => `${mod(x, 360)}°`;
const sector = (center, half) => `${fmtDeg(center - half)}–${fmtDeg(center + half)}`;

// Số độ la bàn đo từ tâm nhà ra phương vị: 8 cung mỗi cung 45°, 24 sơn mỗi sơn 15°
const RING = ['B', 'ĐB', 'Đ', 'ĐN', 'N', 'TN', 'T', 'TB'];
export const palaceAt = (deg) => RING[Math.floor(mod(deg + 22.5, 360) / 45)];
export const mountainAt = (deg) => MOUNTAINS[Math.floor(mod(deg + 7.5, 360) / 15)];
export const palaceRange = (key) => sector(PALACE[key].deg, 22.5);

export function chart(center) {
  const c = {};
  FLIGHT.forEach((p, i) => { c[p] = wrap9(center + i); });
  return c;
}

export const yearCenter = (y) => wrap9(2027 - y);                       // 2026 = 1, 2027 = 9
export const monthCenter = (y, monthBranch) => wrap9([8, 5, 2][branchOfYear(y) % 3] - mod(monthBranch - 2, 12));

// Hướng xấu của năm y (năm can chi, tính từ Lập Xuân)
export function yearAfflictions(y) {
  const yb = branchOfYear(y);
  const tamSatCenter = [6, 3, 0, 9][yb % 4];                           // Thân Tý Thìn → Ngọ, Tỵ Dậu Sửu → Mão, ...
  const nguHoang = Object.entries(chart(yearCenter(y))).find(([p, star]) => star === 5 && p !== 'C');
  return [
    { key: 'thaiTue', name: 'Thái Tuế', palace: branchPalace(yb), where: `${PALACE[branchPalace(yb)].name} (${CHI[yb]})`, deg: sector(yb * 30, 7.5) },
    { key: 'tuePha', name: 'Tuế Phá', palace: branchPalace(mod(yb + 6, 12)), where: `${PALACE[branchPalace(mod(yb + 6, 12))].name} (${CHI[mod(yb + 6, 12)]})`, deg: sector(mod(yb + 6, 12) * 30, 7.5) },
    { key: 'tamSat', name: 'Tam Sát', palace: branchPalace(tamSatCenter), where: `${PALACE[branchPalace(tamSatCenter)].name} (${MOUNTAINS[mod(tamSatCenter * 2 - 1, 24)]} ${CHI[tamSatCenter]} ${MOUNTAINS[mod(tamSatCenter * 2 + 1, 24)]})`, deg: sector(tamSatCenter * 30, 22.5) },
    nguHoang && { key: 'nguHoang', name: 'Ngũ Hoàng', palace: nguHoang[0], where: PALACE[nguHoang[0]].name, deg: sector(PALACE[nguHoang[0]].deg, 22.5) },
  ].filter(Boolean);
}

function branchPalace(b) {
  const deg = b * 30;
  return Object.entries(PALACE).find(([, p]) => Math.abs(mod(deg - p.deg + 180, 360) - 180) <= 22.5)[0];
}

const NATURE = { 1: 1, 2: -2, 3: -1, 4: 1, 5: -3, 6: 1, 7: -1, 8: 2, 9: 2 };
export const THEME = { 1: 'quý nhân', 2: 'sức khoẻ yếu', 3: 'tranh cãi', 4: 'học hành, tình duyên', 5: 'xui rủi', 6: 'sự nghiệp', 7: 'mất mát, thị phi', 8: 'tài lộc', 9: 'tài lộc, hỷ sự' };

export function assessPalace(yearStar, monthStar) {
  const stars = [yearStar, monthStar];
  const score = NATURE[yearStar] + NATURE[monthStar];
  const level = stars.includes(5) || score <= -2 || (score <= -1 && stars.some((x) => [2, 3, 7].includes(x))) ? 'tranh'
    : score >= 2 ? 'tot' : 'binh';
  // tách theo dấu phẩy để sao 8 + 9 không ra "tài lộc, hỷ sự, tài lộc"
  const themes = [...new Set(stars.filter((x) => (level === 'tranh' ? NATURE[x] < 0 : NATURE[x] > 0)).flatMap((x) => THEME[x].split(', ')))];
  return { level, score, stars, themes };
}

// Lịch in xếp mỗi cung chỉ theo cặp (sao năm, sao tháng), không xét Thái Tuế hay Tuế Phá:
// tháng Kỷ Hợi y hệt Canh Dần, Canh Tý y hệt Tân Mão, Kỷ Sửu (năm 2025) khớp mọi cặp trùng.
// T tốt, X tránh, H hợp học thuật, h không hợp học, D hợp tình duyên, d tình duyên dễ va chạm.
// Sao năm 2026 đứng yên từng cung nên 12 trang phủ đủ sao năm 2–9; cặp sao năm 1 (trừ 1-8) phải tự suy.
const PAIR = {
  91: 'TH', 92: 'X', 93: 'TD', 94: 'T', 95: 'X', 96: 'X', 97: 'D', 98: 'TD', 99: 'TD',
  51: 'X', 52: 'Xh', 53: 'X', 54: 'X', 55: 'X', 56: 'X', 57: 'X', 58: 'Xh', 59: 'X',
  71: 'TD', 72: 'd', 73: 'X', 74: 'XD', 75: 'X', 76: 'Xd', 77: 'X', 78: 'D', 79: 'XD',
  81: 'T', 82: 'T', 83: 'T', 84: 'TH', 85: 'X', 86: 'T', 87: 'T', 88: 'T', 89: 'T',
  31: 'H', 32: 'Xd', 33: 'X', 34: 'H', 35: 'd', 36: 'X', 37: 'X', 38: 'T', 39: 'T',
  41: 'H', 42: 'X', 43: 'H', 44: 'HD', 45: 'X', 46: 'H', 47: 'X', 48: 'H', 49: 'D',
  61: 'H', 62: 'H', 63: 'X', 64: 'TX', 65: 'X', 66: 'T', 67: 'X', 68: 'T', 69: 'X',
  21: 'X', 22: 'X', 23: 'X', 24: 'HX', 25: 'X', 26: 'd', 27: 'X', 28: 'T', 29: 'T',
  18: 'T',
};
// Mỗi sao có mặt tốt khi gặp cặp hợp và mặt xấu khi gặp cặp khắc
const GOOD_FACE = { 1: 'quý nhân', 2: 'nhà đất', 3: 'khởi sự', 4: 'sáng tạo', 6: 'sự nghiệp', 7: 'giao tiếp', 8: 'tài lộc', 9: 'hỷ sự' };
const BAD_FACE = { 2: 'sức khoẻ', 3: 'tranh cãi, kiện tụng', 5: 'xui rủi, bệnh tật', 7: 'mất trộm, thị phi' };
const BAD_PAIR = { 64: 'lừa đảo, đầu tư', 96: 'va chạm cấp trên, chấn thương', 69: 'va chạm, hiểu lầm', 79: 'cháy nổ, đồ sắc nhọn' };
const TAM_LINH = new Set([62, 24]);
const HOC_NOTE = { 1: 'hợp học tập, thi cử', [-1]: 'không hợp học, nên học chỗ khác' };
const DUYEN_NOTE = { 1: 'hợp vun đắp tình cảm', [-1]: 'dễ bất đồng, nên giữ hoà khí' };

// Đọc một cung theo cặp sao; inferred: lịch in chưa có cặp này, tự suy theo tính chất sao
export function readPalace(y, m) {
  const code = PAIR[y * 10 + m];
  if (!code) {
    const a = assessPalace(y, m);
    return { tot: a.level === 'tot', tranh: a.level === 'tranh', hoc: y * m === 4 && y !== m ? 1 : 0, duyen: 0, inferred: true };
  }
  return {
    tot: code.includes('T'), tranh: code.includes('X'),
    hoc: code.includes('H') ? 1 : code.includes('h') ? -1 : 0,
    duyen: code.includes('D') ? 1 : code.includes('d') ? -1 : 0,
    inferred: false,
  };
}
const goodThemes = (y, m) => [...new Set([GOOD_FACE[y], GOOD_FACE[m]].filter(Boolean))];
const badThemes = (y, m) => (BAD_PAIR[y * 10 + m] ? [BAD_PAIR[y * 10 + m]] : [...new Set([BAD_FACE[y], BAD_FACE[m]].filter(Boolean))]);

// Phong thủy của tháng tiết: phi tinh năm + tháng, rồi tốt, tránh, học thuật, tình duyên từng cung
export function monthFengShui(y, monthBranch) {
  const yc = yearCenter(y), mc = monthCenter(y, monthBranch);
  const ych = chart(yc), mch = chart(mc);
  const palaces = Object.keys(PALACE).map((p) => {
    const ys = ych[p], ms = mch[p], r = readPalace(ys, ms);
    const level = r.tot && r.tranh ? 'mix' : r.tot ? 'tot' : r.tranh ? 'tranh' : 'binh';
    return { key: p, name: PALACE[p].name, stars: [ys, ms], score: NATURE[ys] + NATURE[ms], level, ...r };
  });
  const pick = (field, themes) => palaces.filter((p) => p[field]).map((p) => ({ ...p, themes: themes(...p.stars) }));
  const note = (field, notes) => palaces.filter((p) => p[field]).map((p) => ({
    ...p, good: p[field] > 0,
    note: field === 'hoc' && p.hoc > 0 && TAM_LINH.has(p.stars[0] * 10 + p.stars[1]) ? 'thiền định, tu dưỡng' : notes[p[field]],
  }));
  return {
    pillar: gzName(monthPillar(y, monthBranch)),
    yearCenter: yc, monthCenter: mc, yearChart: ych, monthChart: mch, palaces,
    tot: pick('tot', goodThemes).sort((a, b) => b.score - a.score),
    tranh: pick('tranh', badThemes).sort((a, b) => a.score - b.score),
    hoc: note('hoc', HOC_NOTE).sort((a, b) => b.hoc - a.hoc),
    duyen: note('duyen', DUYEN_NOTE).sort((a, b) => b.duyen - a.duyen),
  };
}

// Lịch âm dương Việt Nam, tiết khí và can chi.
// Âm lịch theo thuật toán của Hồ Ngọc Đức, múi giờ +7.

export const TZ = 7;
export const mod = (a, n) => ((a % n) + n) % n;
const INT = Math.floor;

export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
export const HANH = ['Mộc', 'Hỏa', 'Thổ', 'Kim', 'Thủy'];
export const THU = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
// 24 tiết khí, bắt đầu từ Xuân Phân (kinh độ mặt trời 0°), mỗi tiết 15°
export const TIET = ['Xuân Phân', 'Thanh Minh', 'Cốc Vũ', 'Lập Hạ', 'Tiểu Mãn', 'Mang Chủng', 'Hạ Chí', 'Tiểu Thử', 'Đại Thử', 'Lập Thu', 'Xử Thử', 'Bạch Lộ', 'Thu Phân', 'Hàn Lộ', 'Sương Giáng', 'Lập Đông', 'Tiểu Tuyết', 'Đại Tuyết', 'Đông Chí', 'Tiểu Hàn', 'Đại Hàn', 'Lập Xuân', 'Vũ Thủy', 'Kinh Trập'];

export function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) { a = jd + 32044; b = INT((4 * a + 3) / 146097); c = a - INT(b * 146097 / 4); }
  else { b = 0; c = jd + 32082; }
  const d = INT((4 * c + 3) / 1461), e = c - INT(1461 * d / 4), m = INT((5 * e + 2) / 153);
  return { d: e - INT((153 * m + 2) / 5) + 1, m: m + 3 - 12 * INT(m / 10), y: b * 100 + d - 4800 + INT(m / 10) };
}

export const weekday = (jdn) => mod(jdn, 7);   // 0 = Thứ Hai
export const fmtDate = (jdn) => { const { d, m, y } = jdToDate(jdn); return `${d}/${m}/${y}`; };
export const fmtDay = (jdn) => { const { d, m } = jdToDate(jdn); return `${d}/${m}`; };
export const isoDate = (jdn) => {
  const { d, m, y } = jdToDate(jdn);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
export function jdFromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return jdFromDate(d, m, y);
}

function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

// Kinh độ mặt trời (độ) tại thời điểm jd (UT, có phần lẻ)
export function sunLongitudeDeg(jd) {
  const T = (jd - 2451545.0) / 36525, T2 = T * T, dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  const omega = 125.04 - 1934.136 * T;
  return mod(L0 + DL - 0.00569 - 0.00478 * Math.sin(dr * omega), 360);
}

const sunSector = (dayNumber) => INT(sunLongitudeDeg(dayNumber - 0.5 - TZ / 24) / 30);
const newMoonDay = (k) => INT(newMoon(k) + 0.5 + TZ / 24);

function lunarMonth11(yy) {
  const k = INT((jdFromDate(31, 12, yy) - 2415021) / 29.530588853);
  const nm = newMoonDay(k);
  return sunSector(nm) >= 9 ? newMoonDay(k - 1) : nm;
}

function leapMonthOffset(a11) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last, i = 1, arc = sunSector(newMoonDay(k + i));
  do { last = arc; i++; arc = sunSector(newMoonDay(k + i)); } while (arc !== last && i < 14);
  return i - 1;
}

export function solarToLunar(dd, mm, yy) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);
  let a11 = lunarMonth11(yy), b11 = a11, year;
  if (a11 >= monthStart) { year = yy; a11 = lunarMonth11(yy - 1); }
  else { year = yy + 1; b11 = lunarMonth11(yy + 1); }
  const day = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false, month = diff + 11;
  if (b11 - a11 > 365) {
    const lm = leapMonthOffset(a11);
    if (diff >= lm) { month = diff + 10; if (diff === lm) leap = true; }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) year -= 1;
  return { day, month, year, leap };
}

export const lunarOf = (jdn) => { const { d, m, y } = jdToDate(jdn); return solarToLunar(d, m, y); };

// ----- Can chi -----
export const dayPillar = (jdn) => mod(jdn + 49, 60);            // 0 = Giáp Tý
export const pillarOf = (stem, branch) => mod(6 * stem - 5 * branch, 60);
export const gzName = (i) => `${CAN[i % 10]} ${CHI[i % 12]}`;
export const canEl = (s) => INT(s / 2);
export const yearPillar = (y) => mod(y - 4, 60);
export const branchOfYear = (y) => mod(y + 8, 12);

// Chi tháng theo tiết khí, xét lúc cuối ngày: ngày giao tiết tính sang tháng mới
export const termMonthBranch = (jdn) => mod(INT(mod(sunLongitudeDeg(jdn + 0.5 - TZ / 24) - 315, 360) / 30) + 2, 12);
export const isTermStart = (jdn) => termMonthBranch(jdn) !== termMonthBranch(jdn - 1);

// Năm can chi của một ngày, đổi năm tại Lập Xuân
export function termYear(jdn) {
  const { y, m } = jdToDate(jdn);
  return m <= 2 && mod(termMonthBranch(jdn) - 2, 12) >= 10 ? y - 1 : y;
}

// Can của tháng (theo tiết) trong năm y
export const monthPillar = (y, monthBranch) =>
  pillarOf(mod((yearPillar(y) % 5) * 2 + 2 + mod(monthBranch - 2, 12), 10), monthBranch);

// Khoảng ngày của tháng tiết chứa jdn
export function termMonthRange(jdn) {
  let start = jdn, end = jdn;
  while (!isTermStart(start)) start--;
  while (!isTermStart(end + 1)) end++;
  return { start, end };
}

// Thông tin nền của một ngày, đã đối chiếu với 12 trang lịch in 2026.

import {
  mod, jdToDate, solarToLunar, dayPillar, termMonthBranch, termYear, isTermStart, branchOfYear,
} from './calendar.js';

export const TRUC = ['Kiến', 'Trừ', 'Mãn', 'Bình', 'Định', 'Chấp', 'Phá', 'Nguy', 'Thành', 'Thu', 'Khai', 'Bế'];
export const TRUC_TOT = new Set([1, 4, 5, 7, 8, 10]);   // trực in đỏ: Trừ, Định, Chấp, Nguy, Thành, Khai
// Nghĩa thông dụng của từng trực; sáu trực đỏ khớp câu "Trừ Nguy Định Chấp hoàng, Thành Khai giai khả dụng"
export const TRUC_Y = [
  'khởi dựng, hợp xuất hành, nhậm chức; kỵ động thổ',
  'trừ bỏ cái cũ, hợp chữa bệnh, dọn dẹp',
  'đầy đủ, hợp cầu tài, cúng tế',
  'bình ổn, hợp việc thường ngày',
  'ổn định, hợp ký kết, cưới hỏi',
  'nắm giữ, hợp xây sửa, trồng trọt',
  'phá vỡ, chỉ hợp phá dỡ; kỵ mọi việc lớn',
  'tên nghe xấu nhưng là trực tốt; kỵ leo cao, đi sông nước',
  'hoàn thành, hợp khai trương, cưới hỏi, mọi việc',
  'thu về, hợp thu nợ, nhập kho; kỵ khởi sự mới',
  'mở ra, hợp khai trương, nhập học, bắt đầu việc mới',
  'đóng lại, kỵ khởi sự',
];

export function dayInfo(jdn) {
  const date = jdToDate(jdn);
  const lunar = solarToLunar(date.d, date.m, date.y);
  const di = dayPillar(jdn), b = di % 12;
  const monthBranch = termMonthBranch(jdn), year = termYear(jdn), yearBranch = branchOfYear(year);
  const truc = mod(b - monthBranch, 12);
  return {
    jdn, date, lunar, di, s: di % 10, b, monthBranch, year, yearBranch,
    truc, trucTot: TRUC_TOT.has(truc),
    nguyetPha: truc === 6,                       // chi ngày xung chi tháng
    tuePha: mod(b - yearBranch, 12) === 6,       // chi ngày xung chi năm
    termStart: isTermStart(jdn),
  };
}

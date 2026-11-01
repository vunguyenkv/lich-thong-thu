// Lời khuyên cho một người trong một ngày: nên làm gì, tránh gì.

import { mod, CHI } from './calendar.js';
import { dayInfo } from './day.js';
import { starsOnDay } from './stars.js';

export const VERDICT = {
  toiUu: 'Ngày tối ưu của bạn',
  tot: 'Ngày tốt',
  thuong: 'Ngày bình thường',
  canThan: 'Cần thận trọng',
  xau: 'Ngày xấu',
};

export function dayAdvice(profile, jdn) {
  const info = dayInfo(jdn);
  const stars = starsOnDay(profile, jdn).sort((a, b) => b.opt - a.opt);
  const xung = mod(info.b - profile.b, 12) === 6;
  const xungTuoi = profile.tuoi !== profile.b && mod(info.b - profile.tuoi, 12) === 6;
  const avoid = [];
  if (info.nguyetPha) avoid.push('Nguyệt phá: tránh khởi sự việc lớn như khai trương, ký kết, động thổ, cưới hỏi.');
  if (xung) avoid.push(`Ngày ${CHI[info.b]} xung chi ngày sinh ${CHI[profile.b]}: hạn chế việc quan trọng, cẩn thận khi đi lại.`);
  if (xungTuoi) avoid.push(`Ngày ${CHI[info.b]} xung tuổi ${CHI[profile.tuoi]}: thận trọng với việc lớn.`);
  if (info.tuePha) avoid.push('Tuế phá: ngày xung năm, cân nhắc trước việc lớn.');
  const optimal = !info.nguyetPha && stars.some((s) => s.opt);
  const verdict = info.nguyetPha ? 'xau' : optimal ? 'toiUu' : xung || xungTuoi || info.tuePha ? 'canThan' : info.trucTot ? 'tot' : 'thuong';
  return { info, stars, doList: info.nguyetPha ? [] : stars, avoid, verdict };
}

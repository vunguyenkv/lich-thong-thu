// Bộ quy tắc nhắc: chọn ngày đáng nhắc cho một người, gộp các nhắc cùng ngày thành một tin.

import { CAN, CHI, THU, mod, fmtDate, fmtDay, weekday, gzName, yearPillar, termMonthRange } from './calendar.js';
import { dayInfo, TRUC } from './day.js';
import { starsOnDay } from './stars.js';
import { monthFengShui, yearAfflictions } from './flyingstars.js';
import { thaiTueStatus, branchRelations } from './relations.js';

export const DEFAULTS = {
  optimal: true,     // ngày tối ưu (trùng cả can lẫn chi), trừ ngày Nguyệt phá
  leadDays: 3,       // báo trước ngày tối ưu; 0 để tắt
  badDays: true,     // Nguyệt phá và ngày xung chi ngày sinh
  monthStart: true,  // đầu tháng tiết, đầu năm (Lập Xuân)
  hour: 7, minute: 0,
};

const ORDER = { xau: 0, toiUu: 1, thang: 2, sapToi: 3 };

export function buildReminders(profile, from, to, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const days = new Map();
  const add = (jdn, item) => {
    if (jdn < from || jdn > to) return;
    if (!days.has(jdn)) days.set(jdn, []);
    days.get(jdn).push(item);
  };
  for (let j = from; j <= to + o.leadDays; j++) {
    const info = dayInfo(j);
    if (o.optimal && !info.nguyetPha) {
      const opt = starsOnDay(profile, j).filter((st) => st.opt);
      if (opt.length) {
        add(j, { kind: 'toiUu', stars: opt });
        if (o.leadDays > 0) add(j - o.leadDays, { kind: 'sapToi', target: j, stars: opt });
      }
    }
    if (o.badDays) {
      const xung = mod(info.b - profile.b, 12) === 6;
      if (info.nguyetPha || xung) add(j, { kind: 'xau', nguyetPha: info.nguyetPha, xung });
    }
    if (o.monthStart && info.termStart) add(j, { kind: 'thang', newYear: info.monthBranch === 2 });
  }
  return [...days.keys()].sort((a, b) => a - b).map((j) => compose(profile, j, days.get(j), o));
}

function compose(profile, jdn, items, o) {
  const info = dayInfo(jdn);
  items.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  const titles = [], body = [dayHeader(info)];
  for (const it of items) {
    const t = TEXT[it.kind](profile, info, it);
    titles.push(t.title);
    body.push('', ...t.body);
  }
  return { jdn, hour: o.hour, minute: o.minute, kinds: items.map((i) => i.kind), title: titles.join(' · '), description: body.join('\n') };
}

const dayHeader = (info) => {
  const L = info.lunar;
  return `${THU[weekday(info.jdn)]} ${fmtDate(info.jdn)} · âm lịch ${L.day}/${L.month}${L.leap ? ' nhuận' : ''} · ngày ${gzName(info.di)} · trực ${TRUC[info.truc]}${info.trucTot ? ' (trực tốt)' : ''}`;
};
const names = (stars) => stars.map((st) => st.name).join(', ');
const optLine = (st) => `${st.name} tối ưu (${CAN[st.stem]} ${CHI[st.branches[0]]}): hợp ${st.use}.`;
const palaceList = (ps) => ps.map((p) => `${p.name} (${p.themes.join(', ')})`).join('; ');

const TEXT = {
  toiUu(profile, info, it) {
    const others = starsOnDay(profile, info.jdn).filter((st) => !st.opt);
    const body = it.stars.map(optLine);
    if (others.length) body.push(`Sao khác trong ngày: ${names(others)}.`);
    if (info.tuePha) body.push('Lưu ý: ngày Tuế phá (xung năm), cân nhắc trước việc lớn.');
    return { title: `★ Hôm nay ${names(it.stars)} tối ưu`, body };
  },
  sapToi(profile, info, it) {
    const t = dayInfo(it.target);
    return {
      title: `Còn ${it.target - info.jdn} ngày: ${names(it.stars)} tối ưu (${fmtDay(it.target)})`,
      body: [
        `${THU[weekday(it.target)]} ${fmtDate(it.target)} là ngày ${gzName(t.di)}, trực ${TRUC[t.truc]}.`,
        ...it.stars.map(optLine),
        'Nếu có việc này, hãy xếp vào ngày đó.',
      ],
    };
  },
  xau(profile, info, it) {
    const body = [];
    if (it.nguyetPha) body.push('Nguyệt phá: chi ngày xung chi tháng. Tránh khởi sự việc lớn như khai trương, ký kết, động thổ, cưới hỏi.');
    if (it.xung) body.push(`Ngày ${CHI[info.b]} xung chi ngày sinh ${CHI[profile.b]} của bạn. Hạn chế việc quan trọng, cẩn thận khi đi lại.`);
    const title = it.nguyetPha && it.xung ? '⚠ Nguyệt phá, xung với bạn' : it.nguyetPha ? '⚠ Hôm nay Nguyệt phá' : '⚠ Hôm nay xung với bạn';
    return { title, body };
  },
  thang(profile, info, it) {
    const fs = monthFengShui(info.year, info.monthBranch);
    const range = termMonthRange(info.jdn);
    const opt = [];
    for (let j = range.start; j <= range.end; j++) {
      if (dayInfo(j).nguyetPha) continue;
      const hit = starsOnDay(profile, j).filter((st) => st.opt);
      if (hit.length) opt.push(`${fmtDay(j)} ${names(hit)}`);
    }
    const body = [
      `Tháng ${fs.pillar}: ${fmtDay(range.start)} đến ${fmtDate(range.end)}.`,
      `Khu vực tốt trong nhà: ${palaceList(fs.tot) || 'không có khu vực nổi bật'}.`,
      `Khu vực nên tránh: ${palaceList(fs.tranh) || 'không có'}.`,
      ...(fs.hoc.some((p) => p.good) ? [`Học thuật: ${fs.hoc.filter((p) => p.good).map((p) => p.name).join(', ')}.`] : []),
      ...(fs.duyen.some((p) => p.good) ? [`Tình duyên: ${fs.duyen.filter((p) => p.good).map((p) => p.name).join(', ')}.`] : []),
      'Cách xác định khu vực: đứng ở tâm nhà, đo bằng la bàn; mỗi khu vực rộng 45°, Bắc từ 337.5° đến 22.5°.',
      `Ngày tối ưu của bạn trong tháng: ${opt.join('; ') || 'không có'}.`,
    ];
    let title = `Sang tháng ${fs.pillar}`;
    if (it.newYear) {
      const yName = gzName(yearPillar(info.year));
      title = `Năm mới ${yName} · ${title}`;
      const tt = thaiTueStatus(profile.tuoi, info.yearBranch);
      const dayRel = branchRelations(profile.b, info.yearBranch);
      body.unshift(
        `Năm ${yName} bắt đầu từ Lập Xuân hôm nay. Tránh động thổ, sửa chữa lớn ở các hướng:`,
        ...yearAfflictions(info.year).map((a) => `- ${a.name}: ${a.where}, ${a.deg}`),
        `Tuổi ${CHI[profile.tuoi]} của bạn: ${tt.length ? tt.join(', ') : 'không phạm Thái Tuế'}.`
          + (dayRel.length ? ` Chi ngày sinh ${CHI[profile.b]} ${dayRel.join(', ')} với năm, nên thận trọng hơn.` : ''),
        '',
      );
    }
    body.push('Khu vực tốt, tránh, học thuật, tình duyên xếp theo cặp sao năm và sao tháng.');
    return { title, body };
  },
};

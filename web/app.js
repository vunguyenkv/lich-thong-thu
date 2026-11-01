// Trang công khai: khách tự đăng ký bằng email, tự nhập ngày giờ sinh, hệ thống tự
// tính bát tự và hiện lá số, ngày tốt, nhắc nhở — chỉ thấy được hồ sơ của chính mình.
// Phân quyền (ai thấy gì) nằm ở luật RLS trong supabase/schema.sql, không phải ở file này.

import {
  CAN, CHI, HANH, THU, mod, jdFromDate, jdToDate, jdFromISO, fmtDate, fmtDay, isoDate,
  weekday, gzName, canEl, yearPillar, monthPillar, branchOfYear,
} from './src/calendar.js';
import { dayInfo, TRUC, TRUC_Y } from './src/day.js';
import { computeProfile } from './src/stars.js';
import { starIcon } from './src/star-icons.js';
import { buildReminders, DEFAULTS } from './src/reminders.js';
import { monthFengShui, yearAfflictions, PALACE, STAR_NAME, THEME } from './src/flyingstars.js';
import { thaiTueStatus } from './src/relations.js';
import { dayAdvice, VERDICT } from './src/advice.js';
import { toICS } from './src/ics.js';
import { parseDate, slugify } from './src/people.js';
import { sendMagicLink, signOut, onAuthChange, amIAdmin, getMyProfile, insertProfile, updateProfile, listProfiles } from './supabase.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bộ nhớ trình duyệt bị chặn */ } },
};

const now = new Date();
const TODAY = jdFromDate(now.getDate(), now.getMonth() + 1, now.getFullYear());
const TABS = ['homnay', 'nhacnho', 'lich', 'laso'];
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HORIZONS = { 30: '30 ngày tới', 90: '3 tháng tới', 365: '1 năm tới' };
const CUNG = ['ĐN', 'N', 'TN', 'Đ', 'C', 'T', 'ĐB', 'B', 'TB'];   // Nam ở trên như lịch in

const state = {
  phase: 'loading',   // loading | signin | sent | onboarding | app
  tab: TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'homnay',
  user: null, profile: null, profileCalc: null, isAdmin: false,
  date: TODAY, month: { y: now.getFullYear(), m: now.getMonth() + 1 },
  rem: { ...DEFAULTS, ...LS.get('ltt:nhac', {}) },
  horizon: LS.get('ltt:tam', 90),
  flash: null, adminRows: null, adminRejecting: null,
};

// ----- Luồng đăng nhập -----
async function init() {
  render();
  onAuthChange(async (user) => {
    state.user = user;
    if (!user) { state.phase = 'signin'; render(); return; }
    await loadProfile();
  });
}

async function loadProfile() {
  state.phase = 'loading';
  render();
  try {
    const admin = await amIAdmin();
    state.isAdmin = admin;
    // Admin luôn vào thẳng trang duyệt hồ sơ, không qua luồng đăng ký/chờ duyệt của khách.
    // Muốn xem lịch của riêng mình, admin vẫn dùng công cụ tư vấn trong Claude như trước.
    if (admin) { await loadAdminQueue(); return; }
    const row = await getMyProfile(state.user.id);
    if (!row) { state.phase = 'onboarding'; render(); return; }
    if (row.status === 'pending') { state.profile = row; state.phase = 'pending'; render(); return; }
    if (row.status === 'rejected') { state.profile = row; state.phase = 'rejected'; render(); return; }
    setProfile(row);
  } catch (e) {
    state.phase = 'signin';
    state.flash = { target: 'signin', kind: 'err', text: `Không tải được hồ sơ: ${e?.message || e?.code}` };
    render();
  }
}

function setProfile(row) {
  state.profile = row;
  state.profileCalc = computeProfile({ name: row.name, y: row.y, m: row.m, d: row.d, hh: row.hh ?? undefined, mi: row.mi ?? undefined });
  state.phase = 'app';
  render();
}

// ----- Quản trị: duyệt hồ sơ khách tự đăng ký -----
async function loadAdminQueue() {
  try {
    state.adminRows = await listProfiles();
    state.phase = 'admin';
    render();
  } catch (e) {
    state.phase = 'signin';
    state.flash = { target: 'signin', kind: 'err', text: `Không tải được danh sách: ${e?.message || e?.code}` };
    render();
  }
}

async function adminSetStatus(id, status, reason) {
  try {
    await updateProfile(id, { status, reject_reason: status === 'rejected' ? (reason || null) : null });
    state.adminRejecting = null;
    await loadAdminQueue();
  } catch (e) {
    state.flash = { target: 'admin', kind: 'err', text: `Chưa đổi được: ${e?.message || e?.code}` };
    render();
  }
}

// ----- Vẽ -----
function render() {
  document.body.dataset.phase = state.phase;
  $('#view').innerHTML = {
    loading: viewLoading, signin: viewSignIn, sent: viewSent, onboarding: viewOnboarding,
    pending: viewPending, rejected: viewRejected, admin: viewAdmin, app: viewApp,
  }[state.phase]();
  if (state.phase === 'app') {
    document.querySelectorAll('.tabs a').forEach((a) => {
      a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + state.tab) && a.setAttribute('aria-current', 'page');
    });
    const pick = document.getElementById('pick-day');
    if (pick) pick.value = isoDate(state.date);
  }
}

const viewLoading = () => '<div class="card center"><p class="muted">Đang tải…</p></div>';

function viewSignIn() {
  const f = state.flash?.target === 'signin' ? `<p class="msg ${state.flash.kind}">${esc(state.flash.text)}</p>` : '';
  return `
  <div class="card center auth-card">
    <span class="brand-mark" aria-hidden="true">✦</span>
    <h1>Lịch Thông Thư</h1>
    <p class="muted">Đăng ký bằng email, nhập ngày sinh một lần — xem ngày tốt, lá số và nhận nhắc nhở của riêng bạn.</p>
    <form id="form-signin">
      <label class="sr" for="f-email">Email</label>
      <input id="f-email" type="email" required placeholder="email@vi-du.com" autocomplete="email">
      <button class="primary" type="submit">Gửi link đăng nhập</button>
    </form>
    ${f}
    <p class="note">Không cần mật khẩu. Bạn sẽ nhận một email có link, bấm vào là vào thẳng trang của mình.</p>
  </div>`;
}

const viewSent = () => `
  <div class="card center auth-card">
    <span class="brand-mark" aria-hidden="true">✉️</span>
    <h1>Kiểm tra email</h1>
    <p>Đã gửi link đăng nhập tới <b>${esc(state.lastEmail)}</b>. Mở email đó trên chính điện thoại hoặc máy tính này và bấm vào link.</p>
    <button data-act="back-signin">Dùng email khác</button>
  </div>`;

function viewOnboarding() {
  const f = state.flash?.target === 'onboarding' ? `<p class="msg ${state.flash.kind}">${esc(state.flash.text)}</p>` : '';
  const opt = (n) => `<option value="${n}">${pad(n)}</option>`;
  const hourOpts = Array.from({ length: 24 }, (_, h) => opt(h)).join('');
  const minOpts = Array.from({ length: 60 }, (_, m) => opt(m)).join('');
  return `
  <div class="card auth-card">
    <h1>Chào bạn mới</h1>
    <p class="muted">Nhập tên và ngày sinh để tính 14 sao, ngày tốt và nhắc nhở của riêng bạn. Giờ sinh và giới tính không bắt buộc, nhưng có giờ sinh thì lá số chính xác hơn.</p>
    <form id="form-onboarding" class="form-onboarding">
      <div class="field"><label for="f-name">Họ tên</label><input id="f-name" required autocomplete="name"></div>
      <div class="field"><label for="f-date">Ngày sinh</label><input id="f-date" placeholder="01/01/2000" inputmode="numeric" required autocomplete="off"></div>
      <div class="field"><label>Giờ sinh (không bắt buộc)</label>
        <div class="gio-phut">
          <select id="f-hh" aria-label="Giờ sinh — giờ"><option value="">Giờ</option>${hourOpts}</select>
          <span class="gio-phut-sep">:</span>
          <select id="f-mi" aria-label="Giờ sinh — phút"><option value="">Phút</option>${minOpts}</select>
        </div>
      </div>
      <div class="field"><label for="f-gender">Giới tính (không bắt buộc)</label>
        <select id="f-gender"><option value="">Chưa rõ</option><option value="nam">Nam</option><option value="nu">Nữ</option></select>
      </div>
      <button class="primary" type="submit">Xem lá số của tôi</button>
    </form>
    ${f}
  </div>`;
}

const viewPending = () => `
  <div class="card center auth-card">
    <span class="brand-mark" aria-hidden="true">⏳</span>
    <h1>Đang chờ duyệt</h1>
    <p>Hồ sơ của <b>${esc(state.profile.name)}</b> đã gửi, đang chờ xác nhận. Quay lại sau hoặc bấm tải lại bên dưới.</p>
    <div class="controls" style="justify-content:center">
      <button data-act="lam-moi">Tải lại</button>
      <button data-act="signout">Đăng xuất</button>
    </div>
  </div>`;

const viewRejected = () => `
  <div class="card center auth-card">
    <span class="brand-mark" aria-hidden="true">✦</span>
    <h1>Chưa thể mở hồ sơ</h1>
    <p>Admin đã từ chối hồ sơ này.${state.profile.reject_reason ? ` Lý do: ${esc(state.profile.reject_reason)}` : ''}</p>
    <p class="muted">Liên hệ trực tiếp nếu cần hỗ trợ thêm.</p>
    <button data-act="signout">Đăng xuất</button>
  </div>`;

function viewAdmin() {
  const rows = state.adminRows || [];
  const f = state.flash?.target === 'admin' ? `<p class="msg ${state.flash.kind}">${esc(state.flash.text)}</p>` : '';
  const nhan = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' };
  const row = (p) => {
    const dangNhapLyDo = state.adminRejecting === p.id;
    return `<li>
      <div><b>${esc(p.name)}</b> <span class="chip chip-${p.status}">${nhan[p.status] || p.status}</span>
        <div class="note">${p.d}/${p.m}/${p.y}${p.hh != null ? ` ${pad(p.hh)}:${pad(p.mi ?? 0)}` : ''}${p.gender ? ` · ${p.gender === 'nam' ? 'Nam' : 'Nữ'}` : ''}${p.email ? ` · ${esc(p.email)}` : ''}</div>
        ${p.status === 'rejected' && p.reject_reason ? `<div class="note">Lý do đã ghi: ${esc(p.reject_reason)}</div>` : ''}
        ${dangNhapLyDo ? `<div class="tu-choi-ly-do">
            <label class="sr" for="ly-do-${p.id}">Lý do từ chối</label>
            <input id="ly-do-${p.id}" placeholder="Lý do (không bắt buộc, khách sẽ thấy)" autocomplete="off">
            <div class="controls">
              <button class="danger" data-act="xac-nhan-tuchoi" data-id="${p.id}">Xác nhận từ chối</button>
              <button data-act="huy-tuchoi">Huỷ</button>
            </div>
          </div>` : ''}
      </div>
      ${dangNhapLyDo ? '' : `<div class="controls">
        <button data-act="duyet" data-id="${p.id}">Duyệt</button>
        <button class="danger" data-act="tuchoi" data-id="${p.id}">Từ chối</button>
      </div>`}
    </li>`;
  };
  const pending = rows.filter((p) => p.status === 'pending');
  const rest = rows.filter((p) => p.status !== 'pending');
  return `
  <header class="bar"><div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><b>Lịch Thông Thư</b></div>
    <div class="who"><span>Quản trị</span><button data-act="signout">Đăng xuất</button></div></header>
  <main>
    <section class="card">
      <h2>Chờ duyệt (${pending.length})</h2>
      ${f}
      ${pending.length ? `<ul class="plain admin-list">${pending.map(row).join('')}</ul>` : '<p class="muted">Không có hồ sơ chờ duyệt.</p>'}
    </section>
    ${rest.length ? `<details class="fold"><summary>Hồ sơ khác (${rest.length})</summary><ul class="plain admin-list">${rest.map(row).join('')}</ul></details>` : ''}
  </main>`;
}

function viewApp() {
  const person = state.profile, profile = state.profileCalc;
  const body = { homnay: viewHomNay, nhacnho: viewNhacNho, lich: viewLich, laso: viewLaSo }[state.tab](person, profile);
  return `
  <header class="bar">
    <div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><b>Lịch Thông Thư</b></div>
    <nav class="tabs" aria-label="Mục">
      <a href="#homnay">Hôm nay</a><a href="#nhacnho">Nhắc nhở</a><a href="#lich">Lịch tháng</a><a href="#laso">Lá số</a>
    </nav>
    <div class="who"><span>${esc(person.name)}</span><button data-act="signout">Đăng xuất</button></div>
  </header>
  <main>${body}</main>`;
}

function verdictReason(a) {
  const names = (list) => list.map((s) => s.name).join(', ');
  const trucText = `Trực ${TRUC[a.info.truc]}${a.info.trucTot ? ' (trực tốt)' : ''}: ${TRUC_Y[a.info.truc]}.`;
  if (a.verdict === 'xau') return 'Nguyệt phá: chi ngày xung chi tháng.';
  if (a.verdict === 'toiUu') return `${names(a.stars.filter((s) => s.opt))} trùng cả can lẫn chi với lá số. ${trucText}`;
  if (a.verdict === 'canThan') return `Ngày xung với bạn hoặc xung năm. ${trucText}`;
  return trucText + (a.stars.length ? ` Có sao ${names(a.stars)}.` : '');
}

function viewHomNay(person, profile) {
  const a = dayAdvice(profile, state.date), info = a.info, L = info.lunar;
  const fs = monthFengShui(info.year, info.monthBranch);
  const mName = gzName(monthPillar(info.year, info.monthBranch)), yName = gzName(yearPillar(info.year));
  const upcoming = buildReminders(profile, state.date + 1, state.date + 14, state.rem).slice(0, 6);
  const where = (p) => p.name + (p.inferred ? '*' : '');
  const chips = (list, cls) => list.map((p) => `<span class="chip${cls}">${where(p)}: ${p.themes.join(', ')}</span>`).join('');
  const notes = (list) => list.map((p) => `<span class="chip${p.good ? '' : ' bad'}">${where(p)}: ${p.note}</span>`).join('');
  const aff = yearAfflictions(info.year);
  const level = Object.fromEntries(fs.palaces.map((p) => [p.key, p.level]));
  const cung = CUNG.map((k) => {
    const name = k === 'C' ? 'Trung cung' : PALACE[k].name, y = fs.yearChart[k], m = fs.monthChart[k];
    const tags = aff.filter((x) => x.palace === k).map((x) => x.name);
    return `<div class="cung ${k === 'C' ? 'c' : level[k]}" role="img" aria-label="${name}: sao năm ${y} ${STAR_NAME[y]}, sao tháng ${m} ${STAR_NAME[m]}${tags.length ? ', ' + tags.join(', ') : ''}">`
      + `<span class="hg">${name}</span><span class="sm">${m}</span><span class="sn">${y}</span>${tags.length ? `<span class="hx">${tags.map((t) => `<span>${t}</span>`).join('')}</span>` : ''}</div>`;
  }).join('');
  return `
  <section class="card">
    <div class="day-nav">
      <button data-act="day" data-d="-1" aria-label="Ngày trước">‹</button>
      <label class="sr" for="pick-day">Chọn ngày</label><input type="date" id="pick-day">
      <button data-act="day" data-d="1" aria-label="Ngày sau">›</button>
      ${state.date !== TODAY ? '<button data-act="today">Hôm nay</button>' : ''}
    </div>
    <h1>${THU[weekday(state.date)]} ${fmtDate(state.date)}</h1>
    <p class="muted">Âm lịch ${L.day}/${L.month}${L.leap ? ' nhuận' : ''} · ngày ${gzName(info.di)} · tháng ${mName} · trực <span class="${info.trucTot ? 'good' : ''}">${TRUC[info.truc]}</span></p>
    <div class="verdict v-${a.verdict}"><b>${VERDICT[a.verdict]}</b><span class="muted">${esc(verdictReason(a))}</span></div>
  </section>
  <section class="card">
    <h2>Nên làm</h2>
    ${a.doList.length
      ? `<ul class="plain">${a.doList.map((st) => `<li><span class="star-name${st.opt ? ' opt' : ''}">${starIcon(st.key)}${st.name}${st.opt ? ' ★ tối ưu' : ''}</span><span>Hợp ${esc(st.use)}.</span></li>`).join('')}</ul>`
      : `<p class="muted">${info.nguyetPha ? 'Hôm nay không nên khởi sự việc lớn.' : 'Không có sao cá nhân hôm nay. Việc thường ngày vẫn làm bình thường.'}</p>`}
    <h2>Nên tránh</h2>
    ${a.avoid.length ? `<ul class="plain">${a.avoid.map((t) => `<li class="warn">${esc(t)}</li>`).join('')}</ul>` : '<p class="muted">Không có cảnh báo riêng cho bạn.</p>'}
  </section>
  <section class="card">
    <h2>Trong nhà, tháng ${mName}</h2>
    <div class="cuu-cung" role="group" aria-label="Cửu cung phi tinh tháng ${mName}, Nam ở trên">${cung}</div>
    <p class="note">Nam ở trên như la bàn phong thủy. Số lớn là sao năm, số nhỏ trong ô vuông là sao tháng. Nền xanh: khu vực tốt; nền đỏ: nên tránh; nửa xanh nửa đỏ: có cả mặt tốt lẫn mặt cần tránh.</p>
    <details class="fold"><summary>Ý nghĩa 9 sao</summary><dl class="afflict">${Object.keys(STAR_NAME).map((n) => `<dt>${n} ${STAR_NAME[n]}</dt><dd>${THEME[n]}</dd>`).join('')}</dl></details>
    <h3>Khu vực tốt</h3>
    <div class="chips">${chips(fs.tot, '') || '<span class="muted">Không có khu vực nổi bật</span>'}</div>
    <h3>Khu vực nên tránh</h3>
    <div class="chips">${chips(fs.tranh, ' bad') || '<span class="muted">Không có</span>'}</div>
    <h3>Học thuật</h3>
    <div class="chips">${notes(fs.hoc) || '<span class="muted">Không có khu vực nổi bật</span>'}</div>
    <h3>Tình duyên</h3>
    <div class="chips">${notes(fs.duyen) || '<span class="muted">Không có khu vực nổi bật</span>'}</div>
    <h3>Hướng xấu năm ${yName}</h3>
    <dl class="afflict">${aff.map((x) => `<dt>${x.name}</dt><dd>${x.where}, ${x.deg}</dd>`).join('')}</dl>
    <p class="note">Cách xếp tốt, tránh, học thuật, tình duyên khớp lịch in 2026; lời giải thích là tóm tắt riêng.${fs.palaces.some((p) => p.inferred) ? ' Dấu * là cặp sao lịch in chưa có, tự suy theo tính chất sao.' : ''}</p>
  </section>
  <section class="card">
    <h2>Sắp tới</h2>
    ${upcoming.length
      ? `<ul class="plain upcoming">${upcoming.map((e) => `<li><span class="when">${fmtDay(e.jdn)}</span><span>${esc(e.title)}</span></li>`).join('')}</ul>`
      : '<p class="muted">Không có nhắc nhở trong 2 tuần tới.</p>'}
    <p><a href="#nhacnho">Xem tất cả nhắc nhở</a></p>
  </section>`;
}

function viewNhacNho(person, profile) {
  const o = state.rem, days = Number(state.horizon);
  const events = buildReminders(profile, TODAY, TODAY + days - 1, o);
  const perWeek = (events.length / (days / 7)).toFixed(1).replace('.', ',');
  const toggle = (key, label) => {
    const on = key === 'leadDays' ? o.leadDays > 0 : o[key];
    return `<label for="t-${key}"><input type="checkbox" id="t-${key}" data-toggle="${key}"${on ? ' checked' : ''}> ${label}</label>`;
  };
  let list = '', lastKey = '';
  for (const e of events) {
    const { m, y } = jdToDate(e.jdn), key = `${m}/${y}`;
    if (key !== lastKey) { list += `<h3>Tháng ${key}</h3>`; lastKey = key; }
    list += `<details class="t-${e.kinds[0]}"><summary><span class="when">${DOW[weekday(e.jdn)]} ${fmtDay(e.jdn)}</span><span class="ttl">${esc(e.title)}</span></summary><pre>${esc(e.description)}</pre></details>`;
  }
  const flash = state.flash?.target === 'dl' ? `<p class="msg ${state.flash.kind}">${esc(state.flash.text)}</p>` : '';
  return `
  <section class="card">
    <h2>Nhắc nhở của ${esc(person.name)}</h2>
    <p class="muted">Mỗi tin là một sự kiện lúc 7h sáng trong lịch điện thoại. Nhiều chuyện cùng ngày gộp thành một tin.</p>
    <div class="controls">
      ${toggle('optimal', 'Ngày tối ưu')} ${toggle('leadDays', 'Báo trước 3 ngày')} ${toggle('badDays', 'Ngày xấu')} ${toggle('monthStart', 'Đầu tháng, đầu năm')}
      <label for="sel-horizon">Xem<select id="sel-horizon">${Object.entries(HORIZONS).map(([k, v]) => `<option value="${k}"${Number(k) === days ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <p><b class="num">${events.length}</b> tin trong ${HORIZONS[days]}, khoảng <b class="num">${perWeek}</b> tin mỗi tuần.</p>
    <div class="controls">
      <button class="primary" data-act="download">Tải file lịch đến hết ${now.getFullYear() + 1}</button>
      ${flash}
    </div>
    <p class="note">File .ics mở được bằng Lịch trên iPhone và Google Lịch trên Android: mở file, ứng dụng lịch sẽ hỏi có thêm vào không.</p>
  </section>
  <section class="card events">${list || '<p class="muted">Không có nhắc nhở trong khoảng này.</p>'}</section>`;
}

function viewLich(person, profile) {
  const { y, m } = state.month;
  const first = jdFromDate(1, m, y), days = jdFromDate(1, m === 12 ? 1 : m + 1, m === 12 ? y + 1 : y) - first;
  const lead = mod(first, 7);
  let cells = DOW.map((w, i) => `<div class="dow${i === 6 ? ' sun' : ''}">${w}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div class="cell blank"></div>';
  for (let i = 0; i < days; i++) {
    const j = first + i, a = dayAdvice(profile, j), info = a.info, L = info.lunar;
    const flag = info.nguyetPha ? '<span class="flag pha">Nguyệt phá</span>' : info.tuePha ? '<span class="flag">Tuế phá</span>' : '';
    const cls = `cell${weekday(j) === 6 ? ' sun' : ''}${j === TODAY ? ' today' : ''}${a.verdict === 'toiUu' ? ' has-opt' : ''}${info.nguyetPha ? ' pha' : ''}`;
    const stars = a.stars.map((st) => `<span class="${st.opt ? 'opt' : ''}" title="${esc(st.name)}${st.opt ? ' ★ tối ưu' : ''}">${starIcon(st.key)}</span>`).join('');
    cells += `<button class="${cls}" data-act="goto" data-j="${j}" aria-label="Xem ngày ${fmtDate(j)}">
      <span class="d"><span class="dn num">${i + 1}</span><span class="lun num">${L.day === 1 ? `${L.day}/${L.month}` : L.day}</span></span>
      <span class="meta"><span class="${info.trucTot ? 'good' : ''}" title="Trực ${TRUC[info.truc]}: ${TRUC_Y[info.truc]}">${TRUC[info.truc]}</span></span>
      ${flag}<span class="stars">${stars}</span></button>`;
  }
  for (let i = 0; i < (7 - ((lead + days) % 7)) % 7; i++) cells += '<div class="cell blank"></div>';
  return `
  <section class="card">
    <div class="day-nav">
      <button data-act="month" data-d="-1" aria-label="Tháng trước">‹</button><h2>Tháng ${m}/${y}</h2>
      <button data-act="month" data-d="1" aria-label="Tháng sau">›</button>
      ${y !== now.getFullYear() || m !== now.getMonth() + 1 ? '<button data-act="this-month">Tháng này</button>' : ''}
    </div>
  </section>
  <div class="cal"><div class="cal-grid">${cells}</div>
    <div class="cal-legend"><span><span class="good">Trực đỏ</span>: ngày tốt nền</span><span><span class="flag pha">Nguyệt phá</span>: nên bỏ qua</span><span>Ô vàng: ngày tối ưu</span></div>
  </div>`;
}

function viewLaSo(person, profile) {
  const L = profile.lunar, yNow = dayInfo(TODAY).year;
  const tt = (y) => { const s = thaiTueStatus(profile.tuoi, branchOfYear(y)); return s.length ? s.join(', ') : 'không phạm Thái Tuế'; };
  const pillars = [['Năm', profile.year], ['Tháng', profile.month], ['Ngày', profile.day, 'day'], ['Giờ', person.hh != null ? profile.hour : null]];
  const starCell = (st) => `<div class="star-cell${st.stem !== null ? ' opt' : ''}"><span class="nm">${st.name}</span><span class="mn">${st.mean}</span><span class="star-art">${starIcon(st.key)}</span><span class="val">${st.stem === null ? `<span>Tất cả</span><strong>${st.branches.map((b) => CHI[b]).join(', ')}</strong>` : `<span>${CAN[st.stem]}</span><strong>${CHI[st.branches[0]]}</strong>`}</span></div>`;
  return `
  <section class="reference-sheet" aria-labelledby="sheet-person">
    <header class="sheet-header"><div><span class="eyebrow">NGÀY TỐT THEO LÁ SỐ CỦA BẠN</span><h2 id="sheet-person">${esc(person.name)} <span>(${person.d}/${person.m}/${person.y})</span></h2></div></header>
    <div class="mobile-master">Nhật chủ <b>${gzName(profile.day)}</b></div>
    <div class="sheet-scroll"><div class="star-table">
      <div class="master-cell master-label">NHẬT<br>CHỦ</div>
      ${profile.stars.slice(0, 7).map(starCell).join('')}
      <div class="master-cell master-value"><span>${CAN[profile.s]}</span><strong>${CHI[profile.b]}</strong></div>
      ${profile.stars.slice(7).map(starCell).join('')}
    </div></div>
  </section>
  <section class="card">
    <h2>Thông tin lá số</h2>
    <p class="muted">Sinh ${person.d}/${person.m}/${person.y}${person.hh != null ? ` lúc ${pad(person.hh)}:${pad(person.mi ?? 0)}` : ''} · âm lịch ${L.day}/${L.month} năm ${gzName(yearPillar(L.year))} · tuổi ${CHI[profile.tuoi]}</p>
    <div class="pillars">${pillars.map(([lbl, i, cls]) => `<div class="${cls ?? ''}"><span class="lbl">${lbl}</span><b>${i === null ? '—' : gzName(i)}</b></div>`).join('')}</div>
    <p>Nhật chủ <b>${CAN[profile.s]} ${HANH[canEl(profile.s)]}</b>.</p>
    <h3>Thái Tuế</h3><p>Năm ${gzName(yearPillar(yNow))}: ${tt(yNow)}. Năm ${gzName(yearPillar(yNow + 1))}: ${tt(yNow + 1)}.</p>
  </section>`;
}

// ----- Hành động -----
function flash(target, text, kind) { state.flash = { target, text, kind }; render(); }

async function download() {
  const { profile: person, profileCalc: profile } = state;
  const events = buildReminders(profile, TODAY, jdFromDate(31, 12, now.getFullYear() + 1), state.rem);
  const id = `${slugify(person.name)}-${person.y}${pad(person.m)}${pad(person.d)}`;
  const ics = toICS({ calName: `Nhắc phong thủy · ${person.name}`, uidPrefix: id, events });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${id}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  flash('dl', `Đã tải ${id}.ics (${events.length} tin nhắc).`, 'ok');
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'day') { state.date += Number(el.dataset.d); render(); }
  else if (act === 'today') { state.date = TODAY; render(); }
  else if (act === 'month') {
    const t = state.month.y * 12 + state.month.m - 1 + Number(el.dataset.d);
    state.month = { y: Math.floor(t / 12), m: mod(t, 12) + 1 };
    render();
  } else if (act === 'this-month') { state.month = { y: now.getFullYear(), m: now.getMonth() + 1 }; render(); }
  else if (act === 'goto') { state.date = Number(el.dataset.j); location.hash = 'homnay'; state.tab = 'homnay'; render(); }
  else if (act === 'download') await download();
  else if (act === 'signout') await signOut();
  else if (act === 'back-signin') { state.phase = 'signin'; render(); }
  else if (act === 'lam-moi') await loadProfile();
  else if (act === 'duyet') await adminSetStatus(el.dataset.id, 'approved');
  else if (act === 'tuchoi') { state.adminRejecting = el.dataset.id; render(); $('#ly-do-' + el.dataset.id)?.focus(); }
  else if (act === 'huy-tuchoi') { state.adminRejecting = null; render(); }
  else if (act === 'xac-nhan-tuchoi') {
    const reason = $('#ly-do-' + el.dataset.id)?.value.trim();
    await adminSetStatus(el.dataset.id, 'rejected', reason);
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'pick-day' && el.value) { state.date = jdFromISO(el.value); render(); }
  else if (el.dataset.toggle) {
    const k = el.dataset.toggle;
    state.rem[k] = k === 'leadDays' ? (el.checked ? 3 : 0) : el.checked;
    LS.set('ltt:nhac', { optimal: state.rem.optimal, leadDays: state.rem.leadDays, badDays: state.rem.badDays, monthStart: state.rem.monthStart });
    render();
  } else if (el.id === 'sel-horizon') { state.horizon = Number(el.value); LS.set('ltt:tam', state.horizon); render(); }
});

document.addEventListener('submit', async (e) => {
  if (e.target.id === 'form-signin') {
    e.preventDefault();
    const email = $('#f-email').value.trim();
    try { await sendMagicLink(email); state.lastEmail = email; state.phase = 'sent'; render(); }
    catch (err) { flash('signin', `Chưa gửi được: ${err?.message || err?.code}`, 'err'); }
    return;
  }
  if (e.target.id === 'form-onboarding') {
    e.preventDefault();
    const name = $('#f-name').value.trim(), dateText = $('#f-date').value.trim();
    const hhText = $('#f-hh').value, miText = $('#f-mi').value;
    const date = parseDate(dateText);
    if (!name) return flash('onboarding', 'Nhập họ tên.', 'err');
    if (!date) return flash('onboarding', 'Ngày sinh chưa đúng. Dùng dạng 01/01/2000.', 'err');
    if (Boolean(hhText) !== Boolean(miText)) return flash('onboarding', 'Chọn đủ cả giờ và phút, hoặc để trống cả hai.', 'err');
    try {
      const row = await insertProfile({
        user_id: state.user.id, name, ...date, hh: hhText ? Number(hhText) : null, mi: miText ? Number(miText) : null,
        gender: $('#f-gender').value || null, email: state.user.email,
      });
      // Hồ sơ mới luôn 'pending' (cơ sở dữ liệu tự ép, xem supabase/schema.sql) nên không gọi setProfile() thẳng.
      await loadProfile();
    } catch (err) { flash('onboarding', `Chưa lưu được: ${err?.message || err?.code}`, 'err'); }
  }
});

window.addEventListener('hashchange', () => {
  const t = location.hash.slice(1);
  if (!TABS.includes(t) || state.phase !== 'app') return;
  state.tab = t; state.flash = null; render(); window.scrollTo(0, 0);
});

init();

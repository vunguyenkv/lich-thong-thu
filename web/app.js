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
import { monthFengShui, yearAfflictions, PALACE, STAR_NAME, THEME, palaceAt, mountainAt, palaceRange } from './src/flyingstars.js';
import { thaiTueStatus } from './src/relations.js';
import { dayAdvice, VERDICT } from './src/advice.js';
import { toICS } from './src/ics.js';
import { parseDate, slugify } from './src/people.js';
import { signUpPassword, signInPassword, sendMagicLink, signOut, onAuthChange, amIAdmin, getMyProfile, insertProfile, updateProfile, listProfiles } from './supabase.js';

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
  buoc: 0, huongText: '', degText: '',
  authMode: 'login',   // login | register | magic — chỉ dùng khi phase === 'signin'
  loadingTimerSet: false, loadingSlow: false,
};

// Dịch vài lỗi đăng nhập hay gặp của Supabase sang tiếng Việt; lỗi lạ thì hiện nguyên văn.
function dichLoiAuth(err) {
  const m = err?.message || '';
  if (/Invalid login credentials/i.test(m)) return 'Email hoặc mật khẩu không đúng.';
  if (/Email not confirmed/i.test(m) || err?.code === 'email_not_confirmed') return 'Email này chưa xác nhận. Mở email đăng ký trước đó, bấm vào link xác nhận, rồi đăng nhập lại.';
  if (/User already registered/i.test(m)) return 'Email này đã có tài khoản. Bấm "Đăng nhập" thay vì "Đăng ký".';
  if (/Password should be at least/i.test(m)) return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (/rate limit/i.test(m)) return 'Gửi quá nhiều lần liên tiếp, thử lại sau vài phút.';
  return m || err?.code || 'Có lỗi xảy ra, thử lại.';
}

// ----- Luồng đăng nhập -----
async function init() {
  render();
  onAuthChange(async (user) => {
    state.user = user;
    if (!user) { state.phase = 'signin'; state.authMode = 'login'; render(); return; }
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
  // Mạng chập chờn có thể khiến request tới Supabase treo mãi không trả lời (không
  // lỗi, không thành công) — khi đó trang sẽ kẹt ở "Đang tải…" vô thời hạn. Đặt một
  // hẹn giờ MỘT LẦN cho mỗi lượt tải (cờ loadingTimerSet, không phải chính cái timer
  // — nếu dùng chính timer làm cờ thì lúc nó bắn ra sẽ bị coi là "chưa có timer" và
  // render() lại tự đặt lại loadingSlow về false ngay trong cùng lượt vẽ, nút không
  // bao giờ kịp hiện). Tải quá 8 giây thì tự hiện nút tải lại, không bắt người dùng đoán.
  if (state.phase === 'loading') {
    if (!state.loadingTimerSet) {
      state.loadingTimerSet = true;
      setTimeout(() => { state.loadingSlow = true; render(); }, 8000);
    }
  } else if (state.loadingTimerSet) {
    state.loadingTimerSet = false; state.loadingSlow = false;
  }
  $('#view').innerHTML = {
    loading: viewLoading, signin: viewSignIn, sent: viewSent, confirm: viewConfirm, onboarding: viewOnboarding,
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

const viewLoading = () => state.loadingSlow
  ? '<div class="card center"><p class="muted">Đang tải hơi lâu, có thể do mạng chập chờn.</p><button class="primary" data-act="tai-lai">Tải lại trang</button></div>'
  : '<div class="card center"><p class="muted">Đang tải…</p></div>';

function viewSignIn() {
  const mode = state.authMode;
  const f = state.flash?.target === 'signin' ? `<p class="msg ${state.flash.kind}">${esc(state.flash.text)}</p>` : '';

  if (mode === 'magic') {
    return `
    <div class="card center auth-card">
      <span class="brand-mark" aria-hidden="true">✦</span>
      <h1>Lịch Thông Thư</h1>
      <p class="muted">Quên mật khẩu? Nhập email, bấm gửi link — không cần mật khẩu, bấm vào link trong email là vào thẳng trang của mình.</p>
      <form id="form-magic" novalidate>
        <label class="sr" for="f-email">Email</label>
        <input id="f-email" type="email" placeholder="email@vi-du.com" autocomplete="email">
        <button class="primary" type="submit">Gửi link đăng nhập</button>
      </form>
      ${f}
      <p class="note"><button class="link-btn" data-act="to-login">← Quay lại đăng nhập bằng mật khẩu</button></p>
    </div>`;
  }

  const dangKy = mode === 'register';
  return `
  <div class="card center auth-card">
    <span class="brand-mark" aria-hidden="true">✦</span>
    <h1>Lịch Thông Thư</h1>
    <p class="muted">${dangKy ? 'Đăng ký bằng email và mật khẩu, nhập ngày sinh một lần — xem ngày tốt, lá số và nhận nhắc nhở của riêng bạn.' : 'Đăng nhập để xem ngày tốt, lá số và nhắc nhở của bạn.'}</p>
    <form id="form-auth" class="form-onboarding" novalidate>
      <div class="field"><label for="f-email">Email</label><input id="f-email" type="email" placeholder="email@vi-du.com" autocomplete="email"></div>
      <div class="field"><label for="f-password">Mật khẩu</label><input id="f-password" type="password" placeholder="Ít nhất 6 ký tự" autocomplete="${dangKy ? 'new-password' : 'current-password'}"></div>
      ${dangKy ? '<div class="field"><label for="f-password2">Nhập lại mật khẩu</label><input id="f-password2" type="password" autocomplete="new-password"></div>' : ''}
      <button class="primary" type="submit">${dangKy ? 'Đăng ký' : 'Đăng nhập'}</button>
    </form>
    ${f}
    <p class="note">${dangKy
      ? 'Đã có tài khoản? <button class="link-btn" data-act="to-login">Đăng nhập</button>'
      : 'Chưa có tài khoản? <button class="link-btn" data-act="to-register">Đăng ký</button>'}</p>
    <p class="note"><button class="link-btn" data-act="to-magic">Quên mật khẩu? Đăng nhập bằng link gửi qua email</button></p>
  </div>`;
}

const viewSent = () => `
  <div class="card center auth-card">
    <span class="brand-mark" aria-hidden="true">✉️</span>
    <h1>Kiểm tra email</h1>
    <p>Đã gửi link đăng nhập tới <b>${esc(state.lastEmail)}</b>. Mở email đó trên chính điện thoại hoặc máy tính này và bấm vào link.</p>
    <button data-act="back-signin">Dùng email khác</button>
  </div>`;

const viewConfirm = () => `
  <div class="card center auth-card">
    <span class="brand-mark" aria-hidden="true">✉️</span>
    <h1>Xác nhận email</h1>
    <p>Đã gửi email xác nhận tới <b>${esc(state.lastEmail)}</b>. Mở email đó, bấm vào link để kích hoạt tài khoản, rồi quay lại đăng nhập bằng mật khẩu vừa đặt.</p>
    <button data-act="to-login">Quay lại đăng nhập</button>
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
    <form id="form-onboarding" class="form-onboarding" novalidate>
      <div class="field"><label for="f-name">Họ tên</label><input id="f-name" autocomplete="name"></div>
      <div class="field"><label for="f-date">Ngày sinh</label><input id="f-date" placeholder="01/01/2000" inputmode="numeric" autocomplete="off"></div>
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

// ----- Đo phương vị tại nhà: 5 bước, mỗi bước một hình, ô nhập số độ ở bước 3 và 4 -----
const ARROW = (id) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="mui" d="M0 0L10 5L0 10z"/></marker></defs>`;

const HINH_TAM = '<svg class="ill" viewBox="0 0 300 220" role="img" aria-label="Đo chiều dài và chiều rộng phần nhà chính rồi chia đôi; chỗ hai đường giữa gặp nhau là tâm nhà; ban công không tính">'
  + '<rect class="nha" x="60" y="40" width="200" height="130"/>'
  + '<rect class="phu" x="200" y="170" width="60" height="30"/><text class="trai" x="192" y="188">Ban công: không tính</text>'
  + '<line class="giua" x1="160" y1="40" x2="160" y2="170"/><line class="giua" x1="60" y1="105" x2="260" y2="105"/>'
  + '<path class="kt" d="M60 18V30M260 18V30M60 24H260"/><text x="160" y="11">Chiều dài ÷ 2</text>'
  + '<path class="kt" d="M38 40H50M38 170H50M44 40V170"/><text transform="rotate(-90 24 105)" x="24" y="105">Chiều rộng ÷ 2</text>'
  + '<circle class="tam" cx="160" cy="105" r="7"/><text x="160" y="127">Tâm nhà</text></svg>';

const HINH_LABAN = '<svg class="ill" viewBox="0 0 300 220" role="img" aria-label="Điện thoại mở ứng dụng la bàn, cầm nằm phẳng; xoay máy theo hình số 8 để hiệu chỉnh; tránh xa đồ kim loại">'
  + '<rect class="nha" x="40" y="30" width="86" height="160" rx="14"/><circle class="mat" cx="83" cy="100" r="30"/>'
  + '<path class="kim-bac" d="M83 72L90 100H76Z"/><path class="kim-nam" d="M83 128L90 100H76Z"/>'
  + '<text x="83" y="58">Bắc</text><text class="so" x="83" y="152">135°</text>'
  + '<path class="so8" d="M215 105C245 65 285 75 280 105C275 135 245 145 215 105C185 65 145 75 150 105C155 135 185 145 215 105Z"/>'
  + '<text x="215" y="162">Xoay hình số 8</text><text class="canh" x="215" y="190">Cách tủ lạnh, cột sắt 1 m</text></svg>';

const HINH_CUA = '<svg class="ill" viewBox="0 0 300 220" role="img" aria-label="Đứng ở tâm nhà, quay mặt ra cửa chính, đầu điện thoại chĩa thẳng ra cửa; số độ trên màn hình là hướng nhà">' + ARROW('mui-cua')
  + '<path class="nha" d="M125 180H50V30H250V180H175"/><path class="cua" d="M175 180L156 160"/>'
  + '<text x="150" y="50">Màn hình: 135°</text><text class="tot" x="150" y="70">→ nhà hướng Đông Nam</text>'
  + '<ellipse class="nguoi" cx="150" cy="100" rx="22" ry="10"/><circle class="dau" cx="150" cy="100" r="9"/><rect class="may" x="143" y="114" width="14" height="20" rx="3"/><text class="trai" x="122" y="100">Bạn ở tâm</text>'
  + '<line class="chi" x1="150" y1="138" x2="150" y2="176" marker-end="url(#mui-cua)"/><text class="phai" x="162" y="156">Chĩa ra cửa</text>'
  + '<text x="150" y="203">Cửa chính</text></svg>';

const HINH_PHONG = '<svg class="ill" viewBox="0 0 300 220" role="img" aria-label="Vẫn đứng ở tâm nhà, xoay người chĩa điện thoại về từng phòng và đọc số độ">' + ARROW('mui-phong')
  + '<rect class="nha" x="30" y="20" width="240" height="170"/><path class="tuong" d="M150 20V78M150 132V190M30 105H118M182 105H270"/>'
  + '<circle class="tam" cx="150" cy="105" r="7"/>'
  + [[105, 75], [195, 75], [105, 135], [195, 135]].map(([x, y]) => `<line class="chi" x1="${150 + (x - 150) * 0.3}" y1="${105 + (y - 105) * 0.3}" x2="${x}" y2="${y}" marker-end="url(#mui-phong)"/>`).join('')
  + '<text x="75" y="42">Phòng ngủ</text><text class="so" x="75" y="60">265°</text>'
  + '<text x="225" y="42">Bếp</text><text class="so" x="225" y="60">10°</text>'
  + '<text class="so" x="75" y="150">190°</text><text x="75" y="168">Phòng khách</text>'
  + '<text class="so" x="225" y="150">80°</text><text x="225" y="168">Bàn làm việc</text></svg>';

// Mặt bằng mẫu: tâm nhà và 8 vùng 45°, Nam ở trên như bảng 9 ô
const PLAN = (() => {
  const cx = 150, cy = 140, rad = Math.PI / 180;
  const at = (d, r) => [cx - r * Math.sin(d * rad), cy + r * Math.cos(d * rad)].map((v) => v.toFixed(1));
  const rays = Array.from({ length: 8 }, (_, k) => { const [x, y] = at(22.5 + 45 * k, 220); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join('');
  const names = Object.values(PALACE).map((p) => { const [x, y] = at(p.deg, 80); return `<text x="${x}" y="${y}">${p.name}</text>`; }).join('');
  return '<svg class="ill" viewBox="0 0 300 290" role="img" aria-label="Mặt bằng nhà: từ tâm nhà chia 8 vùng mỗi vùng 45 độ, Nam ở trên giống bảng 9 ô">'
    + '<defs><clipPath id="plan-nha"><rect x="30" y="40" width="240" height="200"/></clipPath></defs>'
    + `<g class="ray" clip-path="url(#plan-nha)">${rays}</g>`
    + '<rect class="nha" x="30" y="40" width="240" height="200" rx="4"/>'
    + `<circle class="tam" cx="${cx}" cy="${cy}" r="6"/><text x="${cx}" y="${cy + 22}">Tâm nhà</text>${names}`
    + '<text class="dir" x="150" y="22">↑ Nam</text><text class="dir" x="150" y="268">↓ Bắc</text></svg>';
})();

const BUOC = [
  { ten: 'Tìm tâm nhà', hinh: HINH_TAM, y: [
    'Chỉ tính phần nhà chính có mái che, bỏ ban công, sân, gara, chái phụ.',
    'Đo chiều dài rồi chia đôi, đo chiều rộng rồi chia đôi. Chỗ hai đường giữa gặp nhau là tâm nhà, đánh dấu bằng băng keo.',
    'Chung cư chỉ tính trong căn hộ. Nhà nhiều tầng thì mỗi tầng tìm tâm riêng. Nhà hình chữ L lấy tâm của khối nhà chính.',
  ] },
  { ten: 'Chuẩn bị la bàn', hinh: HINH_LABAN, y: [
    'iPhone mở ứng dụng La bàn có sẵn. Android mở Google Maps hoặc một ứng dụng la bàn.',
    'Tháo ốp lưng có nam châm, rồi xoay máy theo hình số 8 vài vòng để máy tự hiệu chỉnh.',
    'Tránh xa tủ lạnh, két sắt, cột sắt, ổ điện khoảng 1 mét. Dùng la bàn thường thì đặt nằm phẳng, đợi kim đứng yên, xoay mặt số cho vạch 0 trùng đầu kim chỉ Bắc.',
  ] },
  { ten: 'Đứng ở tâm, quay mặt ra cửa chính', hinh: HINH_CUA, o: 'huong', y: [
    'Đứng đúng điểm tâm nhà, mặt nhìn thẳng ra cửa chính.',
    'Cầm điện thoại nằm phẳng ngang ngực, đầu điện thoại chĩa thẳng ra cửa. Đợi số đứng yên rồi đọc: đó là hướng nhà.',
    'Đo hai, ba lần. Lệch nhau vài độ là bình thường; lệch nhiều là đang gần đồ kim loại, nên dịch ra một chút.',
  ] },
  { ten: 'Chĩa về từng phòng', hinh: HINH_PHONG, o: 'phong', y: [
    'Vẫn đứng ở tâm nhà, xoay người cho đầu điện thoại chĩa về phía phòng cần xem: bếp, phòng ngủ, bàn làm việc, két tiền.',
    'Đọc số độ rồi nhập vào ô dưới để biết phòng đó thuộc vùng nào và tháng này tốt hay nên tránh.',
  ] },
  { ten: 'Vẽ 8 vùng lên mặt bằng', hinh: PLAN, bang: true, y: [
    'Từ tâm nhà chia 8 vùng, mỗi vùng 45°, theo bảng số độ bên dưới.',
    'Khi so với bảng 9 ô, xoay bảng cho ô Nam trùng phía Nam thật của nhà, đừng đặt nguyên bảng lên giấy.',
    'Hướng nhà (cửa chính nhìn ra đâu) khác phương vị. Bảng 9 ô dùng phương vị, tính từ tâm nhà.',
  ] },
];

// Số độ người dùng gõ: null nếu bỏ trống, NaN nếu sai, còn lại là số 0–360
function parseDeg(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!t) return null;
  const deg = Number(t);
  return Number.isFinite(deg) && deg >= 0 && deg <= 360 ? deg : NaN;
}
// Tên vùng bên cạnh khi số đo cách ranh giới dưới 3°
const nearEdge = (deg) => { const off = mod(deg + 22.5, 45); return off < 3 || off > 42 ? PALACE[palaceAt(off < 3 ? deg - 3 : deg + 3)].name : null; };

// Bước 3: số độ khi chĩa ra cửa chính là hướng nhà, sau lưng là tọa
function huongReading(text) {
  const deg = parseDeg(text);
  if (deg === null) return 'Nhập số độ trên màn hình khi đầu điện thoại chĩa ra cửa chính.';
  if (Number.isNaN(deg)) return 'Số độ phải từ 0 đến 360.';
  const out = [`<b>Nhà hướng ${PALACE[palaceAt(deg)].name}</b>, tọa ${PALACE[palaceAt(deg + 180)].name} (tọa ${mountainAt(deg + 180)} hướng ${mountainAt(deg)}).`];
  const edge = nearEdge(deg);
  if (edge) out.push(`Số đo sát ranh giới với hướng ${edge}, nên đo lại cho chắc.`);
  return out.join(' ');
}

// Bước 4: số độ khi chĩa về một phòng ra vùng trên bảng 9 ô của tháng đang xem
function degReading(text) {
  const deg = parseDeg(text);
  if (deg === null) return 'Nhập số độ trên màn hình khi đầu điện thoại chĩa về phòng đó.';
  if (Number.isNaN(deg)) return 'Số độ phải từ 0 đến 360.';
  const info = dayInfo(state.date), fs = monthFengShui(info.year, info.monthBranch), key = palaceAt(deg);
  const find = (list) => list.find((x) => x.key === key);
  const tot = find(fs.tot), tranh = find(fs.tranh), hoc = find(fs.hoc), duyen = find(fs.duyen);
  const out = [`<b>${deg}° là ${PALACE[key].name}</b> (sơn ${mountainAt(deg)}).`];
  if (tot) out.push(`Tháng ${fs.pillar}: khu vực tốt, ${tot.themes.join(', ')}.`);
  if (tranh) out.push(`Tháng ${fs.pillar}: nên tránh, ${tranh.themes.join(', ')}.`);
  if (!tot && !tranh) out.push(`Tháng ${fs.pillar}: bình thường.`);
  if (hoc) out.push(`Học thuật: ${hoc.note}.`);
  if (duyen) out.push(`Tình duyên: ${duyen.note}.`);
  const aff = yearAfflictions(info.year).filter((x) => x.palace === key).map((x) => x.name);
  if (aff.length) out.push(`Năm nay có ${aff.join(', ')}: không động thổ, sửa chữa lớn ở vùng này.`);
  const edge = nearEdge(deg);
  if (edge) out.push(`Số đo sát ranh giới với ${edge}, nên đo lại cho chắc.`);
  if (find(fs.palaces).inferred) out.push('Cặp sao này lịch in chưa có, đang tự suy.');
  return out.join(' ');
}

function viewDoNha() {
  const i = state.buoc, b = BUOC[i];
  const pills = BUOC.map((x, k) => `<button data-act="buoc" data-n="${k}" aria-label="Bước ${k + 1}: ${x.ten}"${k === i ? ' aria-current="step"' : ''}>${k + 1}</button>`).join('');
  const input = (id, label, hint, value, out) => `<div class="tra-do"><label for="${id}">${label}</label>`
    + `<div class="deg-row"><input id="${id}" inputmode="decimal" autocomplete="off" placeholder="${hint}" value="${esc(value)}"><span class="muted">độ</span></div>`
    + `<p id="${id}-out" role="status">${out}</p></div>`;
  const tra = b.o === 'huong' ? input('f-huong', 'Số độ khi chĩa ra cửa chính', 'vd 135', state.huongText, huongReading(state.huongText))
    : b.o === 'phong' ? input('f-deg', 'Số độ khi chĩa về phòng', 'vd 210', state.degText, degReading(state.degText)) : '';
  const bang = b.bang ? `<dl class="do-bang">${['B', 'ĐB', 'Đ', 'ĐN', 'N', 'TN', 'T', 'TB'].map((k) => `<dt>${PALACE[k].name}</dt><dd>${palaceRange(k)}</dd>`).join('')}</dl>` : '';
  return `
      <section class="card do-nha" id="do-nha">
        <h2>Đo phương vị tại nhà</h2>
        <div class="buoc-so" role="group" aria-label="Các bước">${pills}</div>
        <div class="buoc-hinh">${b.hinh}</div>
        <h3 id="buoc-tieu-de" tabindex="-1">Bước ${i + 1}. ${b.ten}</h3>
        <ul class="buoc-y">${b.y.map((t) => `<li>${t}</li>`).join('')}</ul>
        ${tra}${bang}
        <div class="buoc-nav">
          ${i > 0 ? `<button data-act="buoc" data-n="${i - 1}">‹ Bước trước</button>` : '<span></span>'}
          ${i < BUOC.length - 1 ? `<button class="primary" data-act="buoc" data-n="${i + 1}">Bước tiếp ›</button>` : '<button data-act="buoc" data-n="0">Về bước 1</button>'}
        </div>
      </section>`;
}

// Cuộn tới thẻ hướng dẫn và đưa con trỏ bàn phím về tiêu đề bước
function showStep() {
  document.getElementById('do-nha')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  document.getElementById('buoc-tieu-de')?.focus({ preventScroll: true });
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
    <button class="link-btn" data-act="den-do-nha">Phòng nào thuộc ô nào? Xem cách đo tại nhà ↓</button>
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
  ${viewDoNha()}
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
  else if (act === 'to-login') { state.phase = 'signin'; state.authMode = 'login'; state.flash = null; render(); }
  else if (act === 'to-register') { state.phase = 'signin'; state.authMode = 'register'; state.flash = null; render(); }
  else if (act === 'to-magic') { state.phase = 'signin'; state.authMode = 'magic'; state.flash = null; render(); }
  else if (act === 'lam-moi') await loadProfile();
  else if (act === 'duyet') await adminSetStatus(el.dataset.id, 'approved');
  else if (act === 'tuchoi') { state.adminRejecting = el.dataset.id; render(); $('#ly-do-' + el.dataset.id)?.focus(); }
  else if (act === 'huy-tuchoi') { state.adminRejecting = null; render(); }
  else if (act === 'xac-nhan-tuchoi') {
    const reason = $('#ly-do-' + el.dataset.id)?.value.trim();
    await adminSetStatus(el.dataset.id, 'rejected', reason);
  }
  else if (act === 'buoc') { state.buoc = Number(el.dataset.n); render(); showStep(); }
  else if (act === 'den-do-nha') showStep();
  else if (act === 'tai-lai') location.reload();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'f-deg') { state.degText = e.target.value; $('#f-deg-out').innerHTML = degReading(state.degText); }
  else if (e.target.id === 'f-huong') { state.huongText = e.target.value; $('#f-huong-out').innerHTML = huongReading(state.huongText); }
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
  if (e.target.id === 'form-magic') {
    e.preventDefault();
    const email = $('#f-email').value.trim();
    if (!email) return flash('signin', 'Nhập email.', 'err');
    try { await sendMagicLink(email); state.lastEmail = email; state.phase = 'sent'; render(); }
    catch (err) { flash('signin', `Chưa gửi được: ${dichLoiAuth(err)}`, 'err'); }
    return;
  }
  if (e.target.id === 'form-auth') {
    e.preventDefault();
    const email = $('#f-email').value.trim(), password = $('#f-password').value;
    if (!email) return flash('signin', 'Nhập email.', 'err');
    if (!password) return flash('signin', 'Nhập mật khẩu.', 'err');
    if (state.authMode === 'register') {
      const password2 = $('#f-password2').value;
      if (password.length < 6) return flash('signin', 'Mật khẩu cần ít nhất 6 ký tự.', 'err');
      if (password !== password2) return flash('signin', 'Hai mật khẩu nhập không khớp.', 'err');
      try {
        const data = await signUpPassword(email, password);
        // Không có session nghĩa là project yêu cầu xác nhận email trước; có session thì
        // onAuthChange tự xử lý tiếp (không cần làm gì thêm ở đây).
        if (!data.session) { state.lastEmail = email; state.phase = 'confirm'; render(); }
      } catch (err) { flash('signin', dichLoiAuth(err), 'err'); }
    } else {
      try { await signInPassword(email, password); }
      catch (err) { flash('signin', dichLoiAuth(err), 'err'); }
    }
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

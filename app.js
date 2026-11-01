// Giao diện web: Hôm nay, Nhắc nhở, Lịch tháng, Lá số, Khách.
// Danh sách khách lưu trong db của trang (khi mở trên Claude), nếu không thì lưu trên trình duyệt.

import { CAN, CHI, HANH, THU, mod, jdFromDate, jdToDate, jdFromISO, fmtDate, fmtDay, isoDate, weekday, gzName, canEl, yearPillar, monthPillar, branchOfYear } from './src/calendar.js';
import { dayInfo, TRUC, TRUC_Y } from './src/day.js';
import { computeProfile } from './src/stars.js';
import { starIcon } from './src/star-icons.js';
import { buildReminders, DEFAULTS } from './src/reminders.js';
import { monthFengShui, yearAfflictions, PALACE, STAR_NAME, THEME, palaceAt, mountainAt, palaceRange } from './src/flyingstars.js';
import { thaiTueStatus } from './src/relations.js';
import { dayAdvice, VERDICT } from './src/advice.js';
import { toICS } from './src/ics.js';
import { parsePeople, parseDate, parseTime, slugify } from './src/people.js';
import { makeZip } from './src/zip.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bộ nhớ trình duyệt bị chặn */ } },
};

const now = new Date();
const TODAY = jdFromDate(now.getDate(), now.getMonth() + 1, now.getFullYear());
const TABS = ['homnay', 'nhacnho', 'lich', 'laso', 'khach'];
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HORIZONS = { 30: '30 ngày tới', 90: '3 tháng tới', 365: '1 năm tới' };
const KEEP = ['f-name', 'f-date', 'f-time', 'f-gender', 'f-paste'];
const CUNG = ['ĐN', 'N', 'TN', 'Đ', 'C', 'T', 'ĐB', 'B', 'TB'];   // Nam ở trên như lịch in

const state = {
  starLayout: 'cards', buoc: 0, degText: '', huongText: '',
  tab: TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'homnay',
  people: [], loaded: false, mode: 'loading',
  selected: LS.get('ltt:chon', null),
  date: TODAY,
  month: { y: now.getFullYear(), m: now.getMonth() + 1 },
  rem: { ...DEFAULTS, ...LS.get('ltt:nhac', {}) },
  horizon: LS.get('ltt:tam', 90),
  flash: null, confirmDelete: null, editing: null, houseOpen: matchMedia('(min-width: 1024px)').matches,
};
let db = null, downloads = null;

const profiles = new Map();
function profileOf(p) {
  const key = [p.y, p.m, p.d, p.hh, p.mi].join('|');
  if (!profiles.has(key)) profiles.set(key, computeProfile({ ...p, hh: p.hh ?? 12, mi: p.mi ?? 0 }));
  return profiles.get(key);
}
const current = () => state.people.find((p) => p.id === state.selected) ?? null;

// ----- Lưu trữ -----
function setPeople(list) {
  state.people = [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  state.loaded = true;
  if (!state.people.some((p) => p.id === state.selected)) state.selected = state.people[0]?.id ?? null;
  render();
}

async function addPerson(p) {
  const rec = { name: p.name, d: p.d, m: p.m, y: p.y, time: p.time || '', gender: p.gender || '', email: p.email || '', createdAt: Date.now() };
  if (p.time) Object.assign(rec, { hh: p.hh, mi: p.mi });
  if (db) return (await db.collection('khach').add(rec)).id;
  const id = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const list = [...LS.get('ltt:khach', []), { id, ...rec }];
  LS.set('ltt:khach', list);
  setPeople(list);
  return id;
}

async function updatePerson(id, p) {
  const previous = state.people.find((person) => person.id === id);
  if (!previous) throw new Error('Hồ sơ không còn tồn tại.');
  const changes = { name: p.name, d: p.d, m: p.m, y: p.y, time: p.time || '',
    hh: p.hh ?? null, mi: p.mi ?? null, gender: p.gender || '' };
  if (db) return db.doc('khach/' + id).update(changes);
  const list = LS.get('ltt:khach', []).map((person) => person.id === id ? { ...person, ...changes } : person);
  LS.set('ltt:khach', list);
  setPeople(list);
}

async function removePerson(id) {
  if (db) return db.doc('khach/' + id).delete();
  const list = LS.get('ltt:khach', []).filter((p) => p.id !== id);
  LS.set('ltt:khach', list);
  setPeople(list);
}

async function init() {
  render();
  const use = (n) => (window.claude?.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null));
  [db, downloads] = await Promise.all([use('db'), use('downloads')]);
  if (db) {
    state.mode = 'db';
    db.collection('khach').onSnapshot(
      (snap) => setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => { db = null; state.mode = 'local'; setPeople(LS.get('ltt:khach', [])); },
    );
  } else {
    state.mode = 'local';
    setPeople(LS.get('ltt:khach', []));
  }
}

// ----- Vẽ -----
function render() {
  const keep = {};
  for (const id of KEEP) { const el = document.getElementById(id); if (el) keep[id] = el.value; }
  const focusId = document.activeElement?.id;

  const sel = $('#sel-person');
  sel.innerHTML = state.people.length
    ? state.people.map((p) => `<option value="${esc(p.id)}"${p.id === state.selected ? ' selected' : ''}>${esc(p.name)}</option>`).join('')
    : `<option value="">${state.loaded ? 'Chưa có hồ sơ' : 'Đang tải hồ sơ…'}</option>`;
  sel.disabled = !state.people.length;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.getAttribute('href') === '#' + state.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const person = current();
  let html;
  if (state.tab === 'khach') html = viewKhach();
  else if (!state.loaded) html = '<div class="card"><p class="muted">Đang tải danh sách hồ sơ…</p></div>';
  else if (!person) html = emptyState();
  else html = { homnay: viewHomNay, nhacnho: viewNhacNho, lich: viewLich, laso: viewLaSo }[state.tab](person, profileOf(person));
  $('#view').innerHTML = html;
  document.body.dataset.tab = state.tab;

  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el) el.value = v; }
  const pick = document.getElementById('pick-day');
  if (pick) pick.value = isoDate(state.date);
  if (focusId && focusId !== 'sel-person') document.getElementById(focusId)?.focus();
}

const emptyState = () => `
  <section class="card empty">
    <span class="empty-orbit" aria-hidden="true">✦</span><span class="eyebrow">XIN CHÀO, NGƯỜI BẠN MỚI</span><h2>Bầu trời của bạn đang chờ.</h2>
    <p>Thêm người đầu tiên: tên và ngày sinh là đủ để tính 14 sao, ngày tốt và nhắc nhở.</p>
    <p><a href="#khach">Thêm hồ sơ</a></p>
  </section>`;

function verdictReason(a) {
  const names = (list) => list.map((s) => s.name).join(', ');
  const trucText = `Trực ${TRUC[a.info.truc]}${a.info.trucTot ? ' (trực tốt)' : ''}: ${TRUC_Y[a.info.truc]}.`;
  if (a.verdict === 'xau') return 'Nguyệt phá: chi ngày xung chi tháng.';
  if (a.verdict === 'toiUu') return `${names(a.stars.filter((s) => s.opt))} trùng cả can lẫn chi với lá số. ${trucText}`;
  if (a.verdict === 'canThan') return `Ngày xung với bạn hoặc xung năm. ${trucText}`;
  return trucText + (a.stars.length ? ` Có sao ${names(a.stars)}.` : '');
}

// ----- Hướng dẫn đo phương vị tại nhà: 5 bước, mỗi bước một hình -----
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
  state.houseOpen = true;
  const house = document.getElementById('house-details');
  if (house) house.open = true;
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
  <div class="grid2">
    <div class="stack">
      <section class="card">
        <div class="day-nav">
          <button data-act="day" data-d="-1" aria-label="Ngày trước">‹</button>
          <label class="sr" for="pick-day">Chọn ngày</label><input type="date" id="pick-day">
          <button data-act="day" data-d="1" aria-label="Ngày sau">›</button>
          ${state.date !== TODAY ? '<button data-act="today">Hôm nay</button>' : ''}
        </div>
        <div class="day-title"><span class="eyebrow">XEM CHO ${esc(person.name.toLocaleUpperCase('vi'))}</span>
          <h1>${THU[weekday(state.date)]} ${fmtDate(state.date)}</h1>
          <p class="muted">Âm lịch ${L.day}/${L.month}${L.leap ? ' nhuận' : ''} · ngày ${gzName(info.di)} · tháng ${mName} · năm ${yName} · trực <span class="${info.trucTot ? 'good' : ''}">${TRUC[info.truc]}</span></p>
        </div>
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
    </div>
    <div class="stack">
      <section class="card">
        <h2>Sắp tới</h2>
        ${upcoming.length
          ? `<ul class="plain upcoming">${upcoming.map((e) => `<li><span class="when">${fmtDay(e.jdn)}</span><span>${esc(e.title)}</span></li>`).join('')}</ul>`
          : '<p class="muted">Không có nhắc nhở trong 2 tuần tới.</p>'}
        <p><a href="#nhacnho">Xem tất cả nhắc nhở</a></p>
      </section>
      <details class="card house-details" id="house-details"${state.houseOpen ? ' open' : ''}>
        <summary>Phong thủy nhà ở, tháng ${mName}<span class="tom-tat"><b class="t">Tốt:</b> ${fs.tot.map((p) => p.name).join(', ') || 'không có'}</span><span class="tom-tat"><b class="x">Tránh:</b> ${fs.tranh.map((p) => p.name).join(', ') || 'không có'}</span></summary>
        <div class="stack house-content">
        <div class="cuu-cung" role="group" aria-label="Cửu cung phi tinh tháng ${mName}, Nam ở trên">${cung}</div>
        <p class="note">Nam ở trên như la bàn phong thủy. Số lớn là sao năm, số nhỏ trong ô vuông là sao tháng. Nền xanh: khu vực tốt; nền đỏ: nên tránh; nửa xanh nửa đỏ: có cả mặt tốt lẫn mặt cần tránh.</p>
        <button class="link-btn" data-act="den-do-nha">Phòng nào thuộc ô nào? Xem cách đo tại nhà ↓</button>
        <details class="fold sao9"><summary>Ý nghĩa 9 sao</summary><dl>${Object.keys(STAR_NAME).map((n) => `<dt>${n} ${STAR_NAME[n]}</dt><dd>${THEME[n]}</dd>`).join('')}</dl></details>
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
        <p class="note">Cách xếp tốt, tránh, học thuật, tình duyên khớp lịch in 2026; lời giải thích là tóm tắt riêng.${fs.palaces.some((p) => p.inferred) ? ' Dấu * là cặp sao lịch in chưa có, tự suy theo tính chất sao.' : ''} Hướng Kỳ Môn theo ngày (quý nhân, tài lộc, sức khoẻ, tình cảm) đang được giải mã, chưa có.</p>
      ${viewDoNha()}
        </div>
      </details>

    </div>
  </div>`;
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
  const endYear = now.getFullYear() + 1;
  return `
  <section class="card">
    <h2>Nhắc nhở của ${esc(person.name)}</h2>
    <p class="muted">Mỗi tin là một sự kiện lúc 7h sáng trong lịch điện thoại. Nhiều chuyện cùng ngày gộp thành một tin.</p>
    <div class="controls">
      ${toggle('optimal', 'Ngày tối ưu')} ${toggle('leadDays', 'Báo trước 3 ngày')} ${toggle('badDays', 'Ngày xấu')} ${toggle('monthStart', 'Đầu tháng, đầu năm')}
      <label for="sel-horizon">Xem
        <select id="sel-horizon">${Object.entries(HORIZONS).map(([k, v]) => `<option value="${k}"${Number(k) === days ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <p><b class="num">${events.length}</b> tin trong ${HORIZONS[days]}, khoảng <b class="num">${perWeek}</b> tin mỗi tuần.</p>
    <div class="controls">
      ${downloads ? `<button class="primary" data-act="download">Tải file lịch đến hết ${endYear}</button>` : '<span class="note">Nút tải file chỉ có khi mở trang trên Claude.</span>'}
      <span class="msg${state.flash?.target === 'dl' ? ' ' + state.flash.kind : ''}" role="status">${state.flash?.target === 'dl' ? esc(state.flash.text) : ''}</span>
    </div>
    <p class="note">File tải về là .zip chứa file lịch .ics. iPhone: mở file trong ứng dụng Tệp, bấm vào file .ics bên trong, chọn "Thêm tất cả". Android: giải nén, rồi nhập file .ics tại calendar.google.com, mục Cài đặt, Nhập và xuất.</p>
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
    const stars = a.stars.map((st) => `<span class="${st.opt ? 'opt' : ''}">${starIcon(st.key)}${st.name}${st.opt ? ' ★' : ''}</span>`).join('');
    cells += `<button class="${cls}" data-act="goto" data-j="${j}" aria-label="Xem ngày ${fmtDate(j)}">
      <span class="d"><span class="dn num">${i + 1}</span><span class="lun num">${L.day === 1 ? `${L.day}/${L.month}` : L.day}</span></span>
      <span class="meta"><span>${gzName(info.di)}</span><span class="${info.trucTot ? 'good' : ''}" title="Trực ${TRUC[info.truc]}: ${TRUC_Y[info.truc]}">${TRUC[info.truc]}</span></span>
      ${flag}<span class="stars">${stars}</span></button>`;
  }
  for (let i = 0; i < (7 - ((lead + days) % 7)) % 7; i++) cells += '<div class="cell blank"></div>';
  return `
  <section class="card">
    <div class="day-nav">
      <button data-act="month" data-d="-1" aria-label="Tháng trước">‹</button>
      <h2>Tháng ${m}/${y}</h2>
      <button data-act="month" data-d="1" aria-label="Tháng sau">›</button>
      ${y !== now.getFullYear() || m !== now.getMonth() + 1 ? '<button data-act="this-month">Tháng này</button>' : ''}
    </div>
    <p class="muted">Lịch của ${esc(person.name)}. Bấm vào một ngày để xem chi tiết.</p>
  </section>
  <div class="cal">
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend"><span><span class="good">Trực đỏ</span>: ngày tốt nền</span><span><span class="flag pha">Nguyệt phá</span>: nên bỏ qua</span><span>Ô vàng, ★: ngày tối ưu</span></div>
  </div>`;
}

function viewLaSo(person, profile) {
  const L = profile.lunar, yNow = dayInfo(TODAY).year;
  const tt = (y) => { const s = thaiTueStatus(profile.tuoi, branchOfYear(y)); return s.length ? s.join(', ') : 'không phạm Thái Tuế'; };
  const pillars = [['Năm', profile.year], ['Tháng', profile.month], ['Ngày', profile.day, 'day'], ['Giờ', person.time ? profile.hour : null]];
  const gender = person.gender === 'nam' ? ' · nam' : person.gender === 'nu' ? ' · nữ' : '';
  const starCell = (st) => `<div class="star-cell${st.stem !== null ? ' opt' : ''}"><span class="nm">${st.name}</span><span class="mn">${st.mean}</span><span class="star-art">${starIcon(st.key)}</span><span class="val">${st.stem === null ? `<span>Tất cả</span><strong>${st.branches.map((b) => CHI[b]).join(', ')}</strong>` : `<span>${CAN[st.stem]}</span><strong>${CHI[st.branches[0]]}</strong>`}</span></div>`;
  return `
  <div class="page-heading"><div><span class="eyebrow">LỊCH THÔNG THƯ · LÁ SỐ</span><h1>Bảng sao cá nhân</h1></div><span class="page-tag">14 sao · Một bảng dễ tra</span></div>
  <section class="reference-sheet${state.starLayout === 'table' ? ' full-table' : ''}" aria-labelledby="sheet-person">
    <header class="sheet-header"><div><span class="eyebrow">NGÀY TỐT THEO LÁ SỐ CỦA BẠN</span><h2 id="sheet-person">${esc(person.name)} <span>(${person.d}/${person.m}/${person.y})</span></h2></div><span class="sheet-seal">14<span>sao</span></span></header>
    <div class="sheet-view-switch" role="group" aria-label="Cách xem bảng sao"><button data-act="star-layout" data-layout="cards" aria-pressed="${state.starLayout === 'cards'}">Dễ đọc</button><button data-act="star-layout" data-layout="table" aria-pressed="${state.starLayout === 'table'}">Nguyên bảng</button></div>
    <div class="mobile-master">Nhật chủ <b>${gzName(profile.day)}</b></div>
    <div class="sheet-scroll" tabindex="0" role="region" aria-label="Bảng 14 sao cá nhân"><div class="star-table">
      <div class="master-cell master-label">NHẬT<br>CHỦ</div>
      ${profile.stars.slice(0, 7).map(starCell).join('')}
      <div class="master-cell master-value"><span>${CAN[profile.s]}</span><strong>${CHI[profile.b]}</strong></div>
      ${profile.stars.slice(7).map(starCell).join('')}
    </div></div>
    <div class="sheet-guide"><div><h3>Cách tra nhanh</h3><p><b>1.</b> Chọn ngày trên lịch tháng.<br><b>2.</b> So chi của ngày với bảng sao cá nhân.<br><b>3.</b> Xem ý nghĩa sao để chọn việc phù hợp.</p></div><div><h3>Khi nào là ngày tối ưu?</h3><p>Với sao có can riêng, ngày trùng <b>cả can lẫn chi</b> là ngày tối ưu. Ngày chỉ trùng chi vẫn dùng được. Kết hợp xem trực, Nguyệt phá và các cảnh báo trong mục Hôm nay.</p></div></div>
    <footer class="sheet-footer">Biểu tượng: <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener noreferrer">Twemoji</a> · CC BY 4.0 · có điều chỉnh</footer>
  </section>
  <details class="profile-details"><summary>Thông tin lá số &amp; Thái Tuế <span aria-hidden="true">＋</span></summary><section class="card personal-card">
    <div class="person-heading"><div><span class="eyebrow">HỒ SƠ CÁ NHÂN</span><h2>${esc(person.name)}</h2></div></div>
    <p class="muted">Sinh ${person.d}/${person.m}/${person.y}${person.time ? ' lúc ' + esc(person.time) : ''} · âm lịch ${L.day}/${L.month} năm ${gzName(yearPillar(L.year))} · tuổi ${CHI[profile.tuoi]}${gender}</p>
    <div class="pillars">${pillars.map(([lbl, i, cls]) => `<div class="${cls ?? ''}"><span class="lbl">${lbl}</span><b>${i === null ? '—' : gzName(i)}</b></div>`).join('')}</div>
    <p>Nhật chủ <b>${CAN[profile.s]} ${HANH[canEl(profile.s)]}</b>. Bảng 14 sao tra theo trụ ngày ${gzName(profile.day)}.</p>
    <h3>Thái Tuế</h3><p>Năm ${gzName(yearPillar(yNow))}: ${tt(yNow)}. Năm ${gzName(yearPillar(yNow + 1))}: ${tt(yNow + 1)}.</p>
  </section></details>`;
}

function viewKhach() {
  const editing = state.people.find((p) => p.id === state.editing);
  const note = state.mode === 'db'
    ? 'Danh sách lưu trong tài khoản Claude của bạn, mở trên điện thoại hay máy tính đều thấy. Người được chia sẻ trang ở mức xem không thấy danh sách này.'
    : state.mode === 'local' ? 'Đang lưu trên trình duyệt này. Mở trang trên Claude để lưu vào tài khoản và xem được trên điện thoại.' : 'Đang kết nối nơi lưu…';
  const flash = (t) => (state.flash?.target === t ? `<p class="msg ${state.flash.kind}" role="status">${esc(state.flash.text).replace(/\n/g, '<br>')}</p>` : '');
  const rows = state.people.map((p) => `
    <li>
      <div><div class="pn">${esc(p.name)}</div><div class="note">${p.d}/${p.m}/${p.y}${p.time ? ' · ' + esc(p.time) : ''} · ngày ${gzName(profileOf(p).day)}</div></div>
      <div class="acts">
        <button data-act="select" data-id="${esc(p.id)}">Xem</button>
        <button data-act="edit" data-id="${esc(p.id)}">Sửa</button>
        <button class="danger" data-act="delete" data-id="${esc(p.id)}">${state.confirmDelete === p.id ? 'Bấm lần nữa để xoá' : 'Xoá'}</button>
      </div>
    </li>`).join('');
  return `
  <div class="grid2">
    <section class="card">
      <h2>Danh sách (${state.people.length})</h2>
      ${state.loaded ? (rows ? `<ul class="plain people">${rows}</ul>` : '<p class="muted">Chưa có ai. Thêm người đầu tiên ở khung bên cạnh.</p>') : '<p class="muted">Đang tải…</p>'}
      <p class="note">${note}</p>
    </section>
    <div class="stack">
      <section class="card">
        <h2 id="person-form-title">${editing ? 'Sửa hồ sơ: ' + esc(editing.name) : 'Thêm một người'}</h2>
        <p class="note">Họ tên và ngày sinh là bắt buộc. Giờ sinh và giới tính có thể để trống.</p>
        <form id="form-add" class="form" novalidate>
          <div class="field"><label for="f-name">Họ tên</label><input id="f-name" autocomplete="off"></div>
          <div class="field"><label for="f-date">Ngày sinh</label><input id="f-date" placeholder="05/05/1988" inputmode="numeric" autocomplete="off"></div>
          <div class="field"><label for="f-time">Giờ sinh</label><input id="f-time" placeholder="08:30" autocomplete="off"></div>
          <div class="field"><label for="f-gender">Giới tính</label><select id="f-gender"><option value="">Chưa rõ</option><option value="nam">Nam</option><option value="nu">Nữ</option></select></div>
          <div class="form-actions"><button class="primary" type="submit">${editing ? 'Lưu thay đổi' : 'Thêm hồ sơ'}</button>${editing ? '<button type="button" data-act="cancel-edit">Hủy</button>' : ''}</div>
        </form>
        ${flash('add')}
      </section>
      <section class="card">
        <h2>Dán danh sách từ Excel</h2>
        <p class="note">Mỗi dòng một người, các cột theo thứ tự: Tên, Ngày sinh, Giờ sinh, Giới tính, Email. Có hay không có dòng tiêu đề đều được.</p>
        <label for="f-paste" class="sr">Danh sách dán vào</label>
        <textarea id="f-paste" placeholder="Nguyễn Văn A&#9;12/03/1990&#9;07:15&#9;Nam"></textarea>
        <div><button class="primary" data-act="paste">Thêm cả danh sách</button></div>
        ${flash('paste')}
      </section>
    </div>
  </div>`;
}

// ----- Hành động -----
function go(tab) {
  if (location.hash !== '#' + tab) location.hash = tab;
  else { state.tab = tab; render(); }
}
function choose(id) { state.selected = id; LS.set('ltt:chon', id); render(); }
function flash(target, text, kind) { state.flash = { target, text, kind }; render(); }

async function download() {
  const person = current(), profile = profileOf(person);
  const events = buildReminders(profile, TODAY, jdFromDate(31, 12, now.getFullYear() + 1), state.rem);
  const id = `${slugify(person.name)}-${person.y}${pad(person.m)}${pad(person.d)}`;
  const ics = toICS({ calName: `Nhắc phong thủy · ${person.name}`, uidPrefix: id, events });
  try {
    await downloads.save({ filename: `${id}.zip`, data: makeZip([{ name: `${id}.ics`, text: ics }]) });
    flash('dl', `Đã gửi file ${id}.zip (${events.length} tin nhắc).`, 'ok');
  } catch (e) {
    flash('dl', e?.code === 'declined' ? 'Bạn đã huỷ tải file.' : `Chưa tải được file: ${e?.message || e?.code || e}`, 'err');
  }
}

$('#view').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act !== 'delete') state.confirmDelete = null;
  if (act === 'buoc') { state.buoc = Number(el.dataset.n); render(); showStep(); }
  else if (act === 'den-do-nha') showStep();
  else if (act === 'star-layout') { state.starLayout = el.dataset.layout === 'table' ? 'table' : 'cards'; render(); }
  else if (act === 'day') { state.date += Number(el.dataset.d); render(); }
  else if (act === 'today') { state.date = TODAY; render(); }
  else if (act === 'month') {
    const t = state.month.y * 12 + state.month.m - 1 + Number(el.dataset.d);
    state.month = { y: Math.floor(t / 12), m: mod(t, 12) + 1 };
    render();
  } else if (act === 'this-month') { state.month = { y: now.getFullYear(), m: now.getMonth() + 1 }; render(); }
  else if (act === 'goto') { state.date = Number(el.dataset.j); go('homnay'); }
  else if (act === 'edit') {
    const person = state.people.find((p) => p.id === el.dataset.id);
    if (!person) return;
    state.editing = person.id; state.flash = null; render();
    $('#f-name').value = person.name;
    $('#f-date').value = `${pad(person.d)}/${pad(person.m)}/${person.y}`;
    $('#f-time').value = person.time || '';
    $('#f-gender').value = person.gender || '';
    $('#form-add').scrollIntoView({ block: 'center' }); $('#f-name').focus({ preventScroll: true });
  }
  else if (act === 'cancel-edit') {
    state.editing = null; state.flash = null; render();
    for (const id of ['f-name', 'f-date', 'f-time', 'f-gender']) $('#' + id).value = '';
  }
  else if (act === 'select') { choose(el.dataset.id); go('homnay'); }
  else if (act === 'delete') {
    if (state.confirmDelete !== el.dataset.id) { state.confirmDelete = el.dataset.id; render(); return; }
    state.confirmDelete = null;
    if (state.editing === el.dataset.id) state.editing = null;
    try { await removePerson(el.dataset.id); } catch (err) { flash('add', `Chưa xoá được: ${err?.message || err?.code}`, 'err'); }
  } else if (act === 'paste') {
    const box = document.getElementById('f-paste');
    const { people, errors } = parsePeople(box.value);
    if (!people.length && !errors.length) { flash('paste', 'Chưa có dữ liệu. Dán các dòng từ Excel vào ô trên.', 'err'); return; }
    let added = 0;
    try { for (const p of people) { await addPerson(p); added++; } } catch (err) {
      errors.push({ line: '-', message: `Dừng sau ${added} người vì chưa lưu được: ${err?.message || err?.code}` });
    }
    if (added) box.value = '';
    const lines = [added ? `Đã thêm ${added} người.` : 'Chưa thêm được ai.', ...errors.map((x) => `Dòng ${x.line}: ${x.message}`)];
    flash('paste', lines.join('\n'), errors.length ? 'err' : 'ok');
  } else if (act === 'download') await download();
});

$('#view').addEventListener('toggle', (e) => {
  if (e.target.id === 'house-details') state.houseOpen = e.target.open;
}, true);

$('#view').addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'pick-day' && el.value) { state.date = jdFromISO(el.value); render(); }
  else if (el.dataset.toggle) {
    const k = el.dataset.toggle;
    state.rem[k] = k === 'leadDays' ? (el.checked ? 3 : 0) : el.checked;
    LS.set('ltt:nhac', { optimal: state.rem.optimal, leadDays: state.rem.leadDays, badDays: state.rem.badDays, monthStart: state.rem.monthStart });
    render();
  } else if (el.id === 'sel-horizon') { state.horizon = Number(el.value); LS.set('ltt:tam', state.horizon); render(); }
});

$('#view').addEventListener('input', (e) => {
  if (e.target.id === 'f-deg') { state.degText = e.target.value; $('#f-deg-out').innerHTML = degReading(state.degText); }
  else if (e.target.id === 'f-huong') { state.huongText = e.target.value; $('#f-huong-out').innerHTML = huongReading(state.huongText); }
});

$('#view').addEventListener('submit', async (e) => {
  if (e.target.id !== 'form-add') return;
  e.preventDefault();
  const name = $('#f-name').value.trim(), dateText = $('#f-date').value.trim(), timeText = $('#f-time').value.trim();
  const date = parseDate(dateText), time = timeText ? parseTime(timeText) : null;
  if (!name) return flash('add', 'Nhập họ tên.', 'err');
  if (!date) return flash('add', 'Ngày sinh chưa đúng. Dùng dạng 05/05/1988.', 'err');
  if (timeText && !time) return flash('add', 'Giờ sinh chưa đúng. Dùng dạng 08:30, hoặc để trống.', 'err');
  const person = { name, ...date, ...(time ?? {}), time: time ? `${pad(time.hh)}:${pad(time.mi)}` : '', gender: $('#f-gender').value };
  try {
    const editing = state.editing;
    const id = editing || await addPerson(person);
    if (editing) await updatePerson(editing, person);
    state.editing = null;
    for (const k of ['f-name', 'f-date', 'f-time']) $('#' + k).value = '';
    $('#f-gender').value = '';
    state.selected = id; LS.set('ltt:chon', id);
    flash('add', `${editing ? 'Đã cập nhật' : 'Đã thêm'} ${name}. Chọn "Xem" để mở hồ sơ.`, 'ok');
  } catch (err) { flash('add', `Chưa lưu được: ${err?.message || err?.code}`, 'err'); }
});

$('#sel-person').addEventListener('change', (e) => choose(e.target.value));
window.addEventListener('hashchange', () => {
  const t = location.hash.slice(1);
  if (!TABS.includes(t)) return;
  state.tab = t; state.flash = null; state.confirmDelete = null; state.editing = null;
  render();
  window.scrollTo(0, 0);
});

document.documentElement.lang = 'vi';   // khung trang của Claude không có thuộc tính lang
init();

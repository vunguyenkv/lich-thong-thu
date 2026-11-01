// 14 sao cá nhân và lá số, đã khớp 28/28 ô trên 2 thẻ in.
// Cả bảng chỉ phụ thuộc trụ ngày sinh: can ngày (s) và chi ngày (b).

import {
  CAN, CHI, TIET, TZ, mod, jdFromDate, jdToDate, solarToLunar, sunLongitudeDeg,
  dayPillar, pillarOf, canEl, yearPillar,
} from './calendar.js';

// Nhóm thập thần → độ lệch hành so với nhật chủ
const FAMILY = { ty: 0, thuc: 1, tai: 2, quan: 3, an: 4 };
// Can có hành của nhóm, âm dương theo chi (chi chẵn = dương)
const stemFor = (s, fam, b) => mod(canEl(s) + FAMILY[fam], 5) * 2 + (b % 2);

export function tenGod(s, x) {
  const rel = mod(canEl(x) - canEl(s), 5), same = (s % 2) === (x % 2);
  return [['Tỷ Kiên', 'Kiếp Tài'], ['Thực Thần', 'Thương Quan'], ['Thiên Tài', 'Chính Tài'], ['Thất Sát', 'Chính Quan'], ['Thiên Ấn', 'Chính Ấn']][rel][same ? 0 : 1];
}

const QUOC_AN = [10, 11, 1, 2, 1, 2, 4, 5, 7, 8];
const NGOC_DUONG = [1, 0, 11, 9, 7, 8, 7, 6, 5, 3];      // âm quý nhân
const HOC_DUONG = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];       // trường sinh của nhật can
const QUY_NHAN = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [6, 2], [5, 3], [5, 3]];
const TAM_HOP_GIUA = [0, 9, 6, 3];
const DICH_MA = [2, 11, 8, 5];
const DAO_HOA = [9, 6, 3, 0];
const DIA_GIAI = [7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 6, 6];

// use: việc hợp với sao, viết lại theo ý nghĩa ghi trên lịch
export const STARS = [
  { key: 'quocAn', name: 'Quốc Ấn', mean: 'Sức mạnh', use: 'làm việc nhóm, tăng uy tín, xin tăng lương', calc: (p) => [QUOC_AN[p.s]] },
  { key: 'ngocDuong', name: 'Ngọc Đường', mean: 'Lợi nhuận', fam: 'tai', use: 'ký hợp đồng, chốt deal, đầu tư sinh lời', calc: (p) => [NGOC_DUONG[p.s]] },
  { key: 'longDuc', name: 'Long Đức', mean: 'Hanh thông', use: 'nhờ người giúp, việc cần suôn sẻ', calc: (p) => [mod(p.b + 7, 12)] },
  { key: 'kimQuy', name: 'Kim Quỹ', mean: 'Tài sản', fam: 'tai', use: 'mua tài sản, vàng, chứng khoán', calc: (p) => [TAM_HOP_GIUA[p.b % 4]] },
  { key: 'dichMa', name: 'Dịch Mã', mean: 'Tăng lực', use: 'khai trương, ra mắt sản phẩm, đẩy dự án', calc: (p) => [DICH_MA[p.b % 4]] },
  { key: 'hocDuong', name: 'Học Đường', mean: 'Tiếp thu', fam: 'an', use: 'học tập, hội họp, tiếp thu', calc: (p) => [HOC_DUONG[p.s]] },
  { key: 'quyNhan', name: 'Quý Nhân', mean: 'Giúp đỡ', use: 'gặp người có thể giúp mình', calc: (p) => QUY_NHAN[p.s] },
  { key: 'tamThai', name: 'Tam Thai', mean: 'Chiến thắng', fam: 'quan', use: 'thi cử, cạnh tranh, thi đấu', calc: (p) => [mod(4 + p.b, 12)] },
  { key: 'batToa', name: 'Bát Toạ', mean: 'Danh tiếng', fam: 'thuc', use: 'thuyết trình, xuất hiện trước đông người', calc: (p) => [mod(10 - p.b, 12)] },
  { key: 'diaGiai', name: 'Địa Giải', mean: 'Nhà cửa', fam: 'thuc', use: 'mua bán nhà đất, tài sản lớn', calc: (p) => [DIA_GIAI[p.b]] },
  { key: 'giaiThan', name: 'Giải Thần', mean: 'Giải quyết', fam: 'ty', use: 'giải quyết tranh chấp, việc khó', calc: (p) => [mod(10 - p.b, 12)] },
  { key: 'thienY', name: 'Thiên Y', mean: 'Chữa lành', fam: 'an', use: 'khám chữa bệnh, hồi phục sức khoẻ', calc: (p) => [mod(p.b - 1, 12)] },
  { key: 'thienHy', name: 'Thiên Hỷ', mean: 'Vui vẻ', fam: 'thuc', use: 'gặp gỡ vui vẻ, thu hút sự chú ý', calc: (p) => [mod(9 - p.b, 12)] },
  { key: 'daoHoa', name: 'Đào Hoa', mean: 'Quyến rũ', use: 'hẹn hò, tạo thiện cảm', calc: (p) => [DAO_HOA[p.b % 4]] },
];

// person: { name, y, m, d, hh, mi, gender }
export function computeProfile(person) {
  const { y, m, d, hh = 12, mi = 0 } = person;
  const jdnCivil = jdFromDate(d, m, y);
  const jdn = hh >= 23 ? jdnCivil + 1 : jdnCivil;              // từ 23h tính sang ngày mới
  const di = dayPillar(jdn), s = di % 10, b = di % 12;

  const lambda = sunLongitudeDeg(jdnCivil - 0.5 + (hh + mi / 60 - TZ) / 24);
  const k = Math.floor(mod(lambda - 315, 360) / 30);              // 0 = tháng Dần
  const by = (m <= 2 && k >= 10) ? y - 1 : y;                      // năm Bát Tự đổi tại Lập Xuân
  const yi = yearPillar(by);
  const mb = mod(k + 2, 12);
  const monthI = pillarOf(mod((yi % 5) * 2 + 2 + k, 10), mb);
  const hb = mod(Math.floor((hh + 1) / 2), 12);
  const hourI = pillarOf(mod((s % 5) * 2 + hb, 10), hb);

  const dd = jdToDate(jdn);
  const lunar = solarToLunar(dd.d, dd.m, dd.y);
  const stars = STARS.map((st) => {
    const branches = st.calc({ s, b });
    const stem = st.fam ? stemFor(s, st.fam, branches[0]) : null;
    return { key: st.key, name: st.name, mean: st.mean, use: st.use, branches, stem, tenGod: stem === null ? null : tenGod(s, stem) };
  });
  return {
    ...person, year: yi, month: monthI, day: di, hour: hourI, s, b,
    lunar, tuoi: mod(lunar.year + 8, 12), tiet: TIET[Math.floor(lambda / 15)], stars,
  };
}

// Sao cá nhân rơi vào một ngày; opt = trùng cả can lẫn chi
export function starsOnDay(profile, jdn) {
  const di = dayPillar(jdn), s = di % 10, b = di % 12;
  return profile.stars
    .filter((st) => st.branches.includes(b))
    .map((st) => ({ ...st, opt: st.stem !== null && st.stem === s }));
}

export const starLabel = (st) => (st.stem !== null ? `${CAN[st.stem]} ${CHI[st.branches[0]]}` : `Tất cả ${st.branches.map((x) => CHI[x]).join(', ')}`);

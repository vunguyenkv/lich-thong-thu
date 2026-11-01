// Quan hệ giữa hai địa chi: xung, hình, hại, phá.

import { mod } from './calendar.js';

const HAI = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
const PHA = [[0, 9], [3, 6], [4, 1], [7, 10], [2, 11], [5, 8]];
const HINH_NHOM = [[2, 5, 8], [1, 10, 7]];     // Dần Tỵ Thân, Sửu Tuất Mùi
const HINH_CAP = [[0, 3]];                      // Tý Mão
const TU_HINH = new Set([4, 6, 9, 11]);         // Thìn, Ngọ, Dậu, Hợi

const inPairs = (pairs, a, b) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export function branchRelations(a, b) {
  const r = [];
  if (a === b && TU_HINH.has(a)) r.push('tự hình');
  if (mod(a - b, 12) === 6) r.push('xung');
  if (a !== b && (HINH_NHOM.some((g) => g.includes(a) && g.includes(b)) || inPairs(HINH_CAP, a, b))) r.push('hình');
  if (inPairs(HAI, a, b)) r.push('hại');
  if (inPairs(PHA, a, b)) r.push('phá');
  return r;
}

// Quan hệ của tuổi (chi năm sinh) với Thái Tuế năm đó
export function thaiTueStatus(tuoi, yearBranch) {
  if (tuoi === yearBranch) return ['năm tuổi (trực Thái Tuế)'];
  return branchRelations(tuoi, yearBranch).map((r) => `${r} Thái Tuế`);
}

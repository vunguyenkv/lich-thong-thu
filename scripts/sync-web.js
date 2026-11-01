// Chép phần tính toán thuần (src/*.js) và CSS bảng lá số từ gốc dự án sang web/,
// để trang web công khai (web/) và công cụ tư vấn trong Claude (index.html + app.js)
// dùng chung một bộ công thức, không bị lệch khi sửa một bên mà quên bên kia.
// Chạy: node scripts/sync-web.js (hoặc npm run sync:web)

import { readdirSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const webSrcDir = join(root, 'web', 'src');

mkdirSync(webSrcDir, { recursive: true });
const files = readdirSync(srcDir).filter((f) => f.endsWith('.js'));
for (const f of files) copyFileSync(join(srcDir, f), join(webSrcDir, f));
copyFileSync(join(root, 'reference-sheet.css'), join(root, 'web', 'reference-sheet.css'));

writeFileSync(
  join(webSrcDir, 'README.md'),
  '# Không sửa tay ở đây\n\nThư mục này là bản chép từ `src/` và `reference-sheet.css` ở gốc dự án,\n'
  + 'tạo bởi `node scripts/sync-web.js`. Sửa công thức ở `src/` rồi chạy lại lệnh đó,\n'
  + 'đừng sửa trực tiếp trong `web/src/`, sửa sẽ mất khi đồng bộ lại.\n',
);

console.log(`Đã chép ${files.length} file từ src/ và reference-sheet.css sang web/`);

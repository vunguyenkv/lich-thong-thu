# Đưa trang đăng ký khách lên mạng (web/)

Trang này khác với công cụ tư vấn trong Claude (`index.html` ở gốc dự án, vẫn dùng
bình thường, không đụng tới). Đây là trang **công khai**, khách tự vào, tự đăng ký
bằng email, tự nhập ngày giờ sinh — không cần tài khoản Claude.

Kiến trúc: `web/` (tĩnh, không cần build) + Supabase (lưu dữ liệu, đăng nhập email) +
Vercel (đăng trang lên mạng, gắn tên miền riêng).

## 1. Tạo project Supabase (miễn phí, không cần thẻ)

1. Vào [supabase.com](https://supabase.com), đăng ký/đăng nhập (dùng GitHub cho nhanh).
2. **New project** → đặt tên bất kỳ (vd `lich-thong-thu`), chọn vùng **Southeast Asia (Singapore)** cho nhanh, đặt một mật khẩu DB (lưu lại phòng khi cần, bình thường không dùng tới).
3. Đợi khoảng 1 phút cho project khởi tạo xong.
4. Vào mục **SQL Editor** (thanh bên trái) → **New query** → mở file [`supabase/schema.sql`](supabase/schema.sql) ở dự án này, dán toàn bộ nội dung vào → bấm **Run**.
   - File này tạo bảng `ho_so` (hồ sơ khách) và luật phân quyền: khách chỉ thấy/sửa được hồ sơ của chính mình, chỉ bạn (email `vunguyen.kv@gmail.com`) thấy và sửa được tất cả.
   - Muốn thêm người khác cũng có quyền admin (vd nhân viên): vào **Table editor** → bảng `admins` → thêm một dòng với email người đó.
5. Vào **Project Settings** (biểu tượng bánh răng) → **API** → copy hai giá trị:
   - **Project URL**
   - **anon public** key (khoá dài, không phải "service_role")
6. Mở [`web/config.js`](web/config.js), điền hai giá trị trên vào `SUPABASE_URL` và `SUPABASE_ANON_KEY`.
7. Vào **Authentication** → **URL Configuration**: điền **Site URL** là tên miền bạn sẽ dùng (vd `https://ten-mien-cua-ban.com`). Nếu chưa gắn tên miền, tạm để trống hoặc điền sau ở bước 4.

## 2. Đưa code lên GitHub

```bash
cd "Lịch Thông Thư"
git remote add origin https://github.com/<tên-đăng-nhập-github>/lich-thong-thu.git
git branch -M main
git push -u origin main
```

(Tạo repo rỗng trên github.com trước, New repository, không tick "Add README".)

## 3. Đăng lên Vercel

1. Vào [vercel.com](https://vercel.com), đăng nhập bằng GitHub.
2. **Add New** → **Project** → chọn repo `lich-thong-thu` vừa đẩy lên.
3. Ở bước cấu hình:
   - **Root Directory**: bấm Edit, chọn thư mục `web`.
   - **Framework Preset**: Other (trang tĩnh, không cần build).
4. Bấm **Deploy**. Xong sẽ có link dạng `https://lich-thong-thu-xxxx.vercel.app` — mở thử, bấm "Gửi link đăng nhập" để kiểm tra luồng thật.

## 4. Gắn tên miền riêng

1. Trong project trên Vercel: **Settings** → **Domains** → **Add** → nhập tên miền của bạn.
2. Vercel chỉ cách thêm bản ghi DNS (thường là một bản ghi `A` hoặc `CNAME`) — vào nơi bạn mua tên miền (iNET, Mắt Bão, Namecheap...), mục quản lý DNS, thêm đúng bản ghi Vercel đưa ra.
3. Đợi DNS cập nhật (vài phút đến vài giờ), Vercel tự cấp HTTPS.
4. Quay lại Supabase → **Authentication** → **URL Configuration**, sửa **Site URL** thành tên miền thật, thêm nó vào **Redirect URLs** luôn — nếu không, link đăng nhập gửi về email sẽ trỏ sai chỗ.

## Sau khi đổi công thức tính toán

Phần tính toán (`src/*.js`) dùng chung cho cả công cụ trong Claude lẫn trang web.
Sửa xong ở `src/`, chạy `npm run sync:web` để chép sang `web/src/`, rồi `git push` —
Vercel tự build lại.

## Kiểm tra nhanh sau khi lên mạng

- Đăng ký thử bằng một email thật, xem có nhận được link không (có thể rơi vào Spam lần đầu).
- Bấm vào link, kiểm tra có vào được form nhập ngày sinh không.
- Nhập một ngày sinh, xem lá số hiện ra có đúng không (so với công cụ trong Claude).
- Vào Supabase → Table editor → bảng `ho_so`, kiểm tra dòng mới đã xuất hiện.
- Đăng nhập lại bằng *email admin* (`vunguyen.kv@gmail.com`) ở một trình duyệt khác (hoặc cửa sổ ẩn danh) để xác nhận chưa có giao diện quản trị riêng trên web — xem toàn bộ hồ sơ khách tạm thời làm ở Supabase Table editor cho tới khi xây giao diện quản trị trên web (bước tiếp theo).

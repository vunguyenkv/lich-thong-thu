# Lịch Thông Thư cá nhân

Bộ tính toán phong thủy cá nhân và nhắc nhở qua lịch điện thoại. Cần Node.js 20 trở lên, không cần cài thêm gói nào.

## Tạo file nhắc nhở cho khách

1. Điền danh sách vào một file CSV, theo mẫu `data/khach-mau.csv`. Cột gồm: Tên, Ngày sinh (05/05/1988), Giờ sinh (08:30, có thể để trống), Giới tính, Email. Dán thẳng từ Excel cũng được.
2. Chạy:

   ```
   npm run ics -- data/khach-mau.csv --from 2026-11-01 --to 2027-12-31
   ```

   Không ghi `--from` thì tính từ hôm nay. Không ghi `--to` thì tính hết năm sau.
3. Mỗi người có một file trong thư mục `out/`, ví dụ `out/nguyen-dinh-vu-19880505.ics`. Gửi file này cho khách qua Zalo hoặc email.

## Khách thêm vào điện thoại

- **iPhone:** mở file, chọn "Thêm tất cả". Mỗi tin nhắc là một sự kiện lúc 7h sáng, có báo thức.
- **Android (Google Calendar):** vào calendar.google.com trên máy tính, chọn Cài đặt › Nhập và xuất, rồi chọn file. Google có thể bỏ báo thức của sự kiện nhập vào, nên cần thử trên máy thật.

Nhập lại file mới không bị trùng sự kiện, vì mỗi sự kiện có mã cố định.

## Nhắc những gì (mặc định)

| Loại | Khi nào |
|---|---|
| Ngày tối ưu (trùng cả can lẫn chi với sao cá nhân, trừ Nguyệt phá) | Trước 3 ngày và 7h sáng hôm đó |
| Ngày xấu: Nguyệt phá, ngày xung chi ngày sinh | 7h sáng hôm đó |
| Đầu tháng tiết: khu vực tốt, tránh, học thuật, tình duyên trong nhà, các ngày tối ưu trong tháng | Ngày giao tiết |
| Đầu năm (Lập Xuân): hướng Thái Tuế, Tuế Phá, Tam Sát, Ngũ Hoàng; tuổi có phạm Thái Tuế không | Ngày Lập Xuân |

Nhiều nhắc cùng ngày được gộp thành một tin. Một người nhận khoảng 3 tin mỗi tuần. Các tuỳ chọn nằm trong `DEFAULTS` của `src/reminders.js`.

## Mức độ tin cậy

| Phần | Kiểm bằng |
|---|---|
| Can chi, âm lịch, tiết khí, 12 trực, Nguyệt phá, Tuế phá | Khớp lunar_python cho 730 ngày 2026–2027, và khớp lịch in BAZI TEAM 2026 |
| 14 sao cá nhân | Khớp 28/28 ô trên 2 thẻ in |
| Phi tinh năm và tháng, hướng xấu của năm | Khớp trang phi tinh và 12 ô phi tinh tháng của lịch in 2026 |
| Khu vực tốt, tránh, học thuật, tình duyên trong tháng | Xếp theo bảng 72 cặp sao (năm, tháng) đọc từ 12 trang phong thủy in 2026, khớp cả 12 trang. Cặp có sao năm 1 (trừ 1-8) lịch chưa có, tự suy và đánh dấu *. Lời giải thích là tóm tắt riêng, không chép văn của lịch |

Chạy kiểm tra: `npm test`

## Cấu trúc

- `src/calendar.js`: âm lịch (thuật toán Hồ Ngọc Đức), tiết khí, can chi
- `src/day.js`: trực, Nguyệt phá, Tuế phá của một ngày
- `src/stars.js`: 14 sao cá nhân, lá số
- `src/flyingstars.js`: phi tinh, hướng xấu của năm, khu vực tốt, tránh, học thuật, tình duyên
- `src/relations.js`: xung, hình, hại, phá giữa các địa chi
- `src/reminders.js`: bộ quy tắc nhắc
- `src/ics.js`: xuất file lịch
- `src/people.js`: đọc danh sách người
- `scripts/make-ics.js`: lệnh tạo file cho cả danh sách
- `web/`: trang công khai, khách tự đăng ký bằng email, tự nhập ngày giờ sinh, chỉ
  thấy hồ sơ của chính mình (Supabase + Vercel). Xem [DEPLOY.md](DEPLOY.md) để đưa
  lên mạng với tên miền riêng. Khác với `index.html` ở gốc dự án — đó là công cụ
  tư vấn riêng cho bạn, chạy trong Claude, quản lý mọi hồ sơ khách.

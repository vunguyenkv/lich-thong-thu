-- Lịch Thông Thư — bảng hồ sơ khách và luật phân quyền (RLS)
-- Dán toàn bộ file này vào Supabase > SQL Editor > New query > Run, chạy một lần.
-- An toàn để chạy lại nhiều lần (mọi lệnh đều "if not exists" hoặc "or replace").

-- ===== Bảng admins: ai được xem/sửa TẤT CẢ hồ sơ =====
-- Mặc định chỉ có email của chủ trang. Muốn thêm nhân viên tư vấn: vào Table editor,
-- mở bảng "admins", thêm một dòng với email của người đó (họ phải đăng nhập bằng
-- đúng email này ở trang web thì mới được tính là admin).
create table if not exists admins (
  email text primary key
);
insert into admins (email) values ('vunguyen.kv@gmail.com') on conflict do nothing;

alter table admins enable row level security;
drop policy if exists "chi admin xem danh sach admin" on admins;
create policy "chi admin xem danh sach admin" on admins for select using (
  exists (select 1 from admins a where a.email = auth.jwt() ->> 'email')
);
-- Không có luật insert/update/delete cho admins qua API: muốn thêm/bớt admin phải
-- vào Table editor hoặc SQL Editor của Supabase, không ai làm được từ trang web.

-- security definer: hàm chạy với quyền của người tạo (bỏ qua RLS của bảng admins),
-- tránh vòng lặp vô hạn khi chính sách của ho_so lại cần đọc bảng admins.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

-- Trang web gọi hàm này để biết nên hiện giao diện khách hay giao diện quản trị.
create or replace function am_i_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin();
$$;
grant execute on function am_i_admin() to authenticated;

-- ===== Bảng ho_so: hồ sơ ngày sinh của từng khách =====
-- user_id = null: admin tự thêm khi tư vấn trực tiếp, khách đó chưa đăng ký tài khoản.
-- user_id khác null: khách tự đăng ký, chỉ chính họ (và admin) đọc/sửa được dòng này.
create table if not exists ho_so (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  d smallint not null check (d between 1 and 31),
  m smallint not null check (m between 1 and 12),
  y smallint not null check (y between 1900 and 2100),
  hh smallint check (hh between 0 and 23),
  mi smallint check (mi between 0 and 59),
  gender text check (gender in ('nam', 'nu')),
  email text,
  created_at timestamptz not null default now()
);

-- Mỗi người chỉ tự tạo được một hồ sơ cho chính mình.
create unique index if not exists ho_so_mot_nguoi_mot_ho_so on ho_so (user_id) where user_id is not null;

alter table ho_so enable row level security;

drop policy if exists "admin doc tat ca ho so" on ho_so;
create policy "admin doc tat ca ho so" on ho_so for select using (is_admin());
drop policy if exists "admin them ho so" on ho_so;
create policy "admin them ho so" on ho_so for insert with check (is_admin());
drop policy if exists "admin sua ho so" on ho_so;
create policy "admin sua ho so" on ho_so for update using (is_admin());
drop policy if exists "admin xoa ho so" on ho_so;
create policy "admin xoa ho so" on ho_so for delete using (is_admin());

drop policy if exists "khach xem ho so cua minh" on ho_so;
create policy "khach xem ho so cua minh" on ho_so for select using (auth.uid() = user_id);
drop policy if exists "khach tao ho so cua minh" on ho_so;
create policy "khach tao ho so cua minh" on ho_so for insert with check (auth.uid() = user_id);
drop policy if exists "khach sua ho so cua minh" on ho_so;
create policy "khach sua ho so cua minh" on ho_so for update using (auth.uid() = user_id);
drop policy if exists "khach xoa ho so cua minh" on ho_so;
create policy "khach xoa ho so cua minh" on ho_so for delete using (auth.uid() = user_id);

-- Kiểm tra nhanh sau khi chạy: hai dòng dưới phải trả về true.
-- select is_admin();  -- chạy khi đã đăng nhập bằng email admin, qua SQL Editor sẽ luôn false (không có phiên đăng nhập)
-- select * from ho_so; -- admin thấy mọi dòng khi gọi từ trang web; người lạ chỉ thấy dòng của chính họ

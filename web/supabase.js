// Lớp mỏng bọc quanh Supabase: đăng nhập bằng email (không cần mật khẩu) và
// đọc/ghi bảng ho_so. Việc ai được xem/sửa gì nằm ở luật RLS trong supabase/schema.sql,
// không phải ở đây — hàm nào gọi cũng được, Supabase tự chặn nếu không đủ quyền.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Gửi link đăng nhập về email; bấm vào link trong email sẽ quay lại đúng trang này.
export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function onAuthChange(fn) {
  supabase.auth.onAuthStateChange((_event, session) => fn(session?.user ?? null));
}

// Có phải admin không (xem supabase/schema.sql: bảng admins + hàm am_i_admin).
export async function amIAdmin() {
  const { data, error } = await supabase.rpc('am_i_admin');
  return !error && data === true;
}

// Hồ sơ của chính người đang đăng nhập (không truyền gì thêm: RLS chỉ cho thấy đúng 1 dòng của họ).
export async function getMyProfile(userId) {
  const { data, error } = await supabase.from('ho_so').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertProfile(row) {
  const { data, error } = await supabase.from('ho_so').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from('ho_so').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProfile(id) {
  const { error } = await supabase.from('ho_so').delete().eq('id', id);
  if (error) throw error;
}

// Toàn bộ hồ sơ: admin thấy hết, người thường chỉ thấy của mình (RLS quyết định, không phải hàm này).
export async function listProfiles() {
  const { data, error } = await supabase.from('ho_so').select('*').order('name');
  if (error) throw error;
  return data;
}

// Điền hai giá trị này sau khi tạo project trên supabase.com:
// Project Settings > API > Project URL, và > API > anon public key.
// Đây là khoá "anon public", được phép lộ ra trình duyệt — việc bảo vệ dữ liệu
// nằm ở luật phân quyền (RLS) trong supabase/schema.sql, không phải ở việc giấu khoá này.
export const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'điền-anon-public-key-ở-đây';

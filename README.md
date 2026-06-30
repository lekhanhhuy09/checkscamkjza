# AntiScam VN — Hệ Thống Kiểm Tra Lừa Đảo

Website + Backend, dữ liệu thật lưu bằng JSON file trên **Volume thật của Railway.app** — không mất khi server restart, tắt máy, hay redeploy.

## 📁 Cấu trúc

```
antiscam/
├── index.html          # Trang chủ — check scam, xem GDV, báo cáo
├── login.html           # Đăng nhập / đăng ký — khóa theo IP thật
├── admin.html            # Trang quản trị — yêu cầu key: lekhanhhuy-adminweb
├── server.js             # Backend Express — API thật, lưu file JSON
├── package.json
├── railway.json          # Cấu hình deploy Railway
└── data/                 # Dùng khi chạy LOCAL. Trên Railway, data nằm ở Volume riêng.
    ├── gdvdata.json
    ├── reportsdata.json
    ├── usersdata.json
    ├── ipdata.json
    └── logsdata.json
```

## 🚀 Deploy lên Railway.app (KHÔNG cần thẻ, data KHÔNG MẤT)

### Bước 1 — Đẩy code lên GitHub
1. Tạo repo mới trên GitHub (vd: `antiscam-vn`).
2. Upload toàn bộ thư mục này lên (giữ nguyên cấu trúc, kể cả thư mục `data/`).

### Bước 2 — Tạo project trên Railway
1. Vào **railway.app** → đăng ký bằng GitHub (không cần thẻ).
2. **New Project** → **Deploy from GitHub repo** → chọn repo `antiscam-vn`.
3. Railway tự nhận diện Node.js, tự chạy `npm install` và `npm start`.

### Bước 3 — Gắn Volume (ổ đĩa thật, đây là bước QUAN TRỌNG NHẤT)
1. Vào project vừa tạo → tab **Settings** của service → mục **Volumes**.
2. Bấm **+ New Volume**.
3. Đặt **Mount Path** là: `/data`
4. Dung lượng mặc định (vài trăm MB) là quá đủ.
5. Railway sẽ tự redeploy sau khi gắn volume.

### Bước 4 — Set biến môi trường để code dùng đúng Volume
1. Vào tab **Variables** của service.
2. Thêm biến:
   - `DATA_DIR` = `/data`
3. Save → Railway tự restart service với biến mới.

✅ Từ giờ, mọi GDV/báo cáo/tài khoản/log admin thêm vào sẽ lưu thẳng vào Volume `/data` — **dù bạn tắt máy tính, xóa cache Chrome, Railway tự restart hay deploy lại code mới, data vẫn còn nguyên 100%**, vì Volume tách biệt hoàn toàn khỏi vòng đời container.

### Bước 5 — Lấy link public
1. Vào tab **Settings** → **Networking** → bấm **Generate Domain**.
2. Railway cho bạn 1 link dạng `https://antiscam-vn-production.up.railway.app`.
3. Dùng link đó để truy cập `index.html`, `login.html`, `admin.html`.

## 🔑 Thông tin đăng nhập mặc định

- **Admin Key (admin.html):** `lekhanhhuy-adminweb`
- **Tài khoản Admin cố định (login.html):**
  - Email: `admin@antiscam.vn`
  - Mật khẩu: `AntiScam@2026!`

  ⚠️ Nên đổi 2 giá trị này trong `server.js` (biến `ADMIN_KEY`, `ADMIN_EMAIL`, mật khẩu) trước khi public.

## 🔒 Bảo mật đã tích hợp

- Mật khẩu user được hash SHA-256 + salt, không lưu plaintext.
- Khóa IP thật ở **server-side**: sai mật khẩu 5 lần → khóa IP 10 phút (chỉnh được trong admin.html → Cài Đặt).
- 1 IP chỉ được đăng ký và đăng nhập 1 tài khoản duy nhất.
- Admin key bảo vệ toàn bộ API quản trị (`/api/admin/*`) bằng header `x-admin-key`.
- Mọi hành động đều được ghi log thật trong `logsdata.json`, xem tại admin.html → Nhật Ký.

## 📊 4 Cấp Bậc GDV

| Cấp Bậc | Màu | Ý nghĩa |
|---|---|---|
| 🟢 GDV Thường | Xanh lá | Mới tham gia, cọc cơ bản |
| 🔵 GDV Cao Cấp | Xanh dương | Uy tín trung bình, cọc cao hơn |
| 🟡 Giao Dịch Uy Tín | Vàng gold | Đã giao dịch nhiều, rất uy tín |
| 🟣 Giao Dịch Viên Quản Trị | Tím | Cấp cao nhất, điều hành/hỗ trợ admin |

Số tiền cọc do **Admin tự nhập tay** khi thêm GDV, hiển thị real-time trên web.

## 🛠 Chạy local để test

```bash
npm install
npm start          # chạy web server tại http://localhost:3000
# Nếu muốn test giống Railway, set DATA_DIR trỏ thư mục khác:
# Windows (PowerShell): $env:DATA_DIR="C:\antiscam-data"; npm start
# Mac/Linux: DATA_DIR=/tmp/antiscam-data npm start
```

## ❓ Vì sao trước đây dùng Render bị mất data?

Free tier của Render dùng filesystem tạm thời (ephemeral) — mỗi lần server "ngủ" rồi thức dậy lại, hoặc bạn redeploy code mới, toàn bộ file ghi trên đĩa container cũ **bị xóa sạch**. Persistent Disk của Render chỉ có ở gói trả phí.

Railway.app free tier có **Volume thật** gắn kèm ngay cả ở free plan — đây là lý do data của bạn từ giờ sẽ không bao giờ mất nữa, miễn là làm đúng Bước 3 và Bước 4 ở trên.

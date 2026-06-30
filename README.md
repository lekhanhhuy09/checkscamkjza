# AntiScam VN — Hệ Thống Kiểm Tra Lừa Đảo

Website + Backend, dữ liệu thật lưu bằng JSON file, deploy trên **Render.com**.

## 📁 Cấu trúc

```
antiscam/
├── index.html          # Trang chủ — check scam, xem GDV, báo cáo
├── login.html           # Đăng nhập / đăng ký — khóa theo IP thật
├── admin.html            # Trang quản trị — yêu cầu key: lekhanhhuy-adminweb
├── server.js             # Backend Express — API thật, lưu file JSON
├── package.json
└── data/
    ├── gdvdata.json        # Danh sách GDV (admin thêm/xóa)
    ├── reportsdata.json    # Báo cáo scam
    ├── usersdata.json      # Tài khoản web (mật khẩu đã hash)
    ├── ipdata.json         # Khóa IP, ràng buộc 1 IP - 1 tài khoản
    ├── logsdata.json       # Nhật ký truy cập / hành động
    └── siteconfig.json     # Cấu hình chung (tự tạo khi lưu lần đầu)
```

## 🚀 Deploy lên Render.com

1. Push toàn bộ thư mục này lên GitHub repo.
2. Trên Render.com: **New → Web Service** → kết nối repo.
3. Cấu hình:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (chạy `node server.js`)
   - **Environment:** Node
4. **⚠️ QUAN TRỌNG — Persistent Disk:** Free plan của Render KHÔNG giữ file qua mỗi lần deploy/restart. Để `data/*.json` không bị mất:
   - Vào tab **Disks** → **Add Disk** → Mount path: `/opt/render/project/src/data` → chọn dung lượng (1GB là đủ).
   - Việc này giữ data thật, không bị xóa khi redeploy.

## 🔑 Thông tin đăng nhập mặc định

- **Admin Key (admin.html):** `lekhanhhuy-adminweb`
- **Tài khoản Admin cố định (login.html):**
  - Email: `admin@antiscam.vn`
  - Mật khẩu: `AntiScam@2026!`
  
  ⚠️ Nên đổi 2 giá trị này trong `server.js` (biến `ADMIN_KEY`, `ADMIN_EMAIL`, mật khẩu) trước khi public.

## 🔒 Bảo mật đã tích hợp

- Mật khẩu user được hash SHA-256 + salt, không lưu plaintext.
- Khóa IP thật ở **server-side** (không thể bypass bằng xóa localStorage): sai mật khẩu 5 lần → khóa IP 10 phút (chỉnh được trong admin.html → Cài Đặt).
- 1 IP chỉ được đăng ký và đăng nhập 1 tài khoản duy nhất.
- Admin key bảo vệ toàn bộ API quản trị (`/api/admin/*`) bằng header `x-admin-key`.
- Mọi hành động (đăng nhập, đăng ký, khóa IP, thêm/xóa GDV, báo cáo) đều được ghi log thật trong `logsdata.json`, xem tại admin.html → Nhật Ký.

## 📊 4 Cấp Bậc GDV

| Cấp Bậc | Màu | Ý nghĩa |
|---|---|---|
| 🟢 GDV Thường | Xanh lá | Mới tham gia, cọc cơ bản |
| 🔵 GDV Cao Cấp | Xanh dương | Uy tín trung bình, cọc cao hơn |
| 🟡 Giao Dịch Uy Tín | Vàng gold | Đã giao dịch nhiều, rất uy tín |
| 🟣 Giao Dịch Viên Quản Trị | Tím | Cấp cao nhất, điều hành/hỗ trợ admin |

Số tiền cọc do **Admin tự nhập tay** khi thêm GDV (không cố định theo cấp bậc), hiển thị real-time trên web.

## 🛠 Chạy local để test

```bash
npm install
npm start          # chạy web server tại http://localhost:3000
```

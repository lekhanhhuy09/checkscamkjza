// ══════════════════════════════════════════════
// AntiScam VN — Backend Server (Node.js + Express)
// Lưu trữ dữ liệu thật bằng JSON file, deploy trên Railway.app (có Volume thật)
// DATA_DIR đọc từ biến môi trường (Railway Volume mount path) hoặc fallback local
// ══════════════════════════════════════════════
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

app.use(express.json());
app.use(express.static(__dirname)); // serve index.html, login.html, admin.html

// ══ HELPER: đọc / ghi file JSON an toàn ══
function readJSON(file, fallback) {
  try {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) { writeJSON(file, fallback); return fallback; }
    const raw = fs.readFileSync(p, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('readJSON error', file, e.message);
    return fallback;
  }
}
function writeJSON(file, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('writeJSON error', file, e.message);
    return false;
  }
}

// ══ PASSWORD HASH (đơn giản, an toàn hơn lưu plaintext) ══
function hashPw(pw) { return crypto.createHash('sha256').update(pw + 'antiscam_salt_2026').digest('hex'); }

// ══ GET REAL CLIENT IP ══
function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip || 'unknown';
}

// ══ LOG HELPER ══
function addLog(type, msg, ip) {
  const logs = readJSON('logsdata.json', []);
  logs.unshift({ type, msg, ip: ip || '—', time: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), ts: Date.now() });
  writeJSON('logsdata.json', logs.slice(0, 1000));
}

// ══ SETTINGS (lock time, max fail) ══
function getSecuritySettings() {
  const cfg = readJSON('siteconfig.json', { locktimeMin: 10, maxFail: 5 });
  return { locktimeMin: cfg.locktimeMin || 10, maxFail: cfg.maxFail || 5 };
}

// ═══════════════════════════════════════
// GDV API
// ═══════════════════════════════════════
app.get('/api/gdv', (req, res) => {
  const gdv = readJSON('gdvdata.json', []);
  res.json(gdv);
});

app.post('/api/gdv', (req, res) => {
  const gdv = readJSON('gdvdata.json', []);
  const item = req.body;
  if (!item.name || !item.bank || !item.deposit) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
  }
  item.id = item.id || String(Date.now());
  item.createdAt = item.createdAt || Date.now();
  gdv.push(item);
  writeJSON('gdvdata.json', gdv);
  addLog('add_gdv', `Thêm GDV mới: ${item.name} (${item.type || 'GDV Thường'})`, getClientIP(req));
  res.json({ success: true, gdv: item });
});

app.delete('/api/gdv/:id', (req, res) => {
  let gdv = readJSON('gdvdata.json', []);
  const target = gdv.find(g => String(g.id) === String(req.params.id));
  gdv = gdv.filter(g => String(g.id) !== String(req.params.id));
  writeJSON('gdvdata.json', gdv);
  addLog('del_gdv', `Xóa GDV: ${target ? target.name : req.params.id}`, getClientIP(req));
  res.json({ success: true });
});

app.patch('/api/gdv/:id', (req, res) => {
  const gdv = readJSON('gdvdata.json', []);
  const idx = gdv.findIndex(g => String(g.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false });
  gdv[idx] = { ...gdv[idx], ...req.body };
  writeJSON('gdvdata.json', gdv);
  res.json({ success: true, gdv: gdv[idx] });
});

// ═══════════════════════════════════════
// REPORTS API
// ═══════════════════════════════════════
app.get('/api/reports', (req, res) => {
  res.json(readJSON('reportsdata.json', []));
});

app.post('/api/reports', (req, res) => {
  const reps = readJSON('reportsdata.json', []);
  const rep = req.body;
  rep.id = rep.id || String(Date.now());
  rep.createdAt = rep.createdAt || Date.now();
  rep.status = rep.status || 'pending';
  reps.unshift(rep);
  writeJSON('reportsdata.json', reps);
  addLog('report', `Báo cáo scam mới: ${rep.scamName || 'Không rõ'}`, getClientIP(req));
  res.json({ success: true, report: rep });
});

app.patch('/api/reports/:id', (req, res) => {
  const reps = readJSON('reportsdata.json', []);
  const idx = reps.findIndex(r => String(r.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false });
  reps[idx] = { ...reps[idx], ...req.body };
  writeJSON('reportsdata.json', reps);
  res.json({ success: true, report: reps[idx] });
});

app.delete('/api/reports/:id', (req, res) => {
  let reps = readJSON('reportsdata.json', []);
  reps = reps.filter(r => String(r.id) !== String(req.params.id));
  writeJSON('reportsdata.json', reps);
  res.json({ success: true });
});

// ═══════════════════════════════════════
// AUTH API — login / register với khóa IP THẬT trên server
// ═══════════════════════════════════════
app.post('/api/register', (req, res) => {
  const ip = getClientIP(req);
  const { name, email, password } = req.body;
  if (!name || !email || !email.includes('@') || !password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Thông tin không hợp lệ (mật khẩu tối thiểu 6 ký tự).' });
  }
  const users = readJSON('usersdata.json', []);
  const ipData = readJSON('ipdata.json', { locks: {}, attempts: {}, ipAccounts: {}, ipRegistered: {} });

  if (users.find(u => u.email === email.toLowerCase())) {
    return res.status(409).json({ success: false, message: 'Email này đã được đăng ký rồi.' });
  }
  if (ipData.ipRegistered[ip]) {
    return res.status(409).json({ success: false, message: `IP ${ip} đã đăng ký tài khoản "${ipData.ipRegistered[ip]}" rồi! Mỗi IP chỉ được 1 tài khoản.` });
  }

  const newUser = {
    name, email: email.toLowerCase(), pwHash: hashPw(password),
    role: 'member', joined: new Date().toLocaleDateString('vi-VN'), ip, createdAt: Date.now()
  };
  users.push(newUser);
  writeJSON('usersdata.json', users);

  ipData.ipRegistered[ip] = email.toLowerCase();
  ipData.ipAccounts[ip] = email.toLowerCase();
  writeJSON('ipdata.json', ipData);

  addLog('register', `Đăng ký mới: ${email} (${name}) từ IP ${ip}`, ip);
  const { pwHash, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

app.get('/api/ip-status', (req, res) => {
  const ip = getClientIP(req);
  const ipData = readJSON('ipdata.json', { locks: {}, attempts: {}, ipAccounts: {}, ipRegistered: {} });
  if (ipData.locks[ip] && ipData.locks[ip] > Date.now()) {
    return res.json({ locked: true, until: ipData.locks[ip], ip });
  }
  return res.json({ locked: false, ip });
});

app.post('/api/login', (req, res) => {
  const ip = getClientIP(req);
  const { email, password } = req.body;
  const { locktimeMin, maxFail } = getSecuritySettings();
  const ipData = readJSON('ipdata.json', { locks: {}, attempts: {}, ipAccounts: {}, ipRegistered: {} });

  // Check IP lock
  if (ipData.locks[ip] && ipData.locks[ip] > Date.now()) {
    const remainMin = Math.ceil((ipData.locks[ip] - Date.now()) / 60000);
    return res.status(423).json({ success: false, locked: true, until: ipData.locks[ip], message: `IP của bạn đang bị khóa. Thử lại sau ${remainMin} phút.` });
  }

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin.' });
  }

  // Fixed admin account (always works regardless of IP-binding)
  const ADMIN_EMAIL = 'admin@antiscam.vn';
  if (email.toLowerCase() === ADMIN_EMAIL && password === 'AntiScam@2026!') {
    addLog('login', `Admin đăng nhập: ${email} từ IP ${ip}`, ip);
    return res.json({ success: true, user: { email: ADMIN_EMAIL, name: 'Admin', role: 'admin', joined: '01/01/2026' } });
  }

  const users = readJSON('usersdata.json', []);
  const user = users.find(u => u.email === email.toLowerCase());

  if (!user || user.pwHash !== hashPw(password)) {
    // record fail attempt
    ipData.attempts[ip] = (ipData.attempts[ip] || 0) + 1;
    if (ipData.attempts[ip] >= maxFail) {
      ipData.locks[ip] = Date.now() + locktimeMin * 60 * 1000;
      writeJSON('ipdata.json', ipData);
      addLog('lock', `IP ${ip} bị khóa do sai mật khẩu ${maxFail} lần`, ip);
      return res.status(423).json({ success: false, locked: true, until: ipData.locks[ip], message: `Sai quá ${maxFail} lần! IP bị khóa ${locktimeMin} phút.` });
    }
    writeJSON('ipdata.json', ipData);
    const remain = maxFail - ipData.attempts[ip];
    return res.status(401).json({ success: false, message: `Email hoặc mật khẩu không đúng. Còn ${remain} lần thử.` });
  }

  // Check 1 IP - 1 account binding (skip for admin)
  const boundAccount = ipData.ipAccounts[ip];
  if (boundAccount && boundAccount !== user.email) {
    return res.status(403).json({ success: false, message: `IP này đã đăng nhập với tài khoản "${boundAccount}". Mỗi IP chỉ được dùng 1 tài khoản.` });
  }
  ipData.ipAccounts[ip] = user.email;
  delete ipData.attempts[ip];
  writeJSON('ipdata.json', ipData);

  addLog('login', `Đăng nhập thành công: ${email} từ IP ${ip}`, ip);
  const { pwHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// ═══════════════════════════════════════
// ADMIN-ONLY API (cần header x-admin-key)
// ═══════════════════════════════════════
const ADMIN_KEY = 'lekhanhhuy-adminweb';
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
  next();
}

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = readJSON('usersdata.json', []).map(({ pwHash, ...u }) => u);
  res.json(users);
});

app.delete('/api/admin/users/:email', requireAdmin, (req, res) => {
  let users = readJSON('usersdata.json', []);
  users = users.filter(u => u.email !== req.params.email);
  writeJSON('usersdata.json', users);
  addLog('admin_action', `Admin xóa tài khoản: ${req.params.email}`, getClientIP(req));
  res.json({ success: true });
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  res.json(readJSON('logsdata.json', []));
});

app.delete('/api/admin/logs', requireAdmin, (req, res) => {
  writeJSON('logsdata.json', []);
  res.json({ success: true });
});

app.get('/api/admin/ip-data', requireAdmin, (req, res) => {
  res.json(readJSON('ipdata.json', { locks: {}, attempts: {}, ipAccounts: {}, ipRegistered: {} }));
});

app.post('/api/admin/unlock-ip', requireAdmin, (req, res) => {
  const { ip } = req.body;
  const ipData = readJSON('ipdata.json', { locks: {}, attempts: {}, ipAccounts: {}, ipRegistered: {} });
  if (ip) { delete ipData.locks[ip]; delete ipData.attempts[ip]; }
  else { ipData.locks = {}; ipData.attempts = {}; }
  writeJSON('ipdata.json', ipData);
  addLog('admin_action', ip ? `Admin mở khóa IP: ${ip}` : 'Admin mở khóa TẤT CẢ IP', getClientIP(req));
  res.json({ success: true });
});

app.get('/api/admin/site-config', requireAdmin, (req, res) => {
  res.json(readJSON('siteconfig.json', { sitename: 'AntiScam VN', footer: '', locktimeMin: 10, maxFail: 5 }));
});
app.post('/api/admin/site-config', requireAdmin, (req, res) => {
  writeJSON('siteconfig.json', req.body);
  res.json({ success: true });
});

// ═══════════════════════════════════════
// PUBLIC: API check scam dùng cho ô tìm kiếm trên web
// ═══════════════════════════════════════
app.get('/api/check', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.status(400).json({ success: false, message: 'Thiếu tham số tìm kiếm (q)' });

  const gdv = readJSON('gdvdata.json', []);
  const reports = readJSON('reportsdata.json', []);

  const foundGdv = gdv.find(g =>
    (g.discord || '').toLowerCase().includes(q) ||
    (g.name || '').toLowerCase().includes(q) ||
    (g.fbLink || '').toLowerCase().includes(q)
  );
  const foundReports = reports.filter(r =>
    (r.social || '').toLowerCase().includes(q) ||
    (r.scamName || '').toLowerCase().includes(q)
  );

  if (foundGdv) {
    return res.json({ success: true, type: 'gdv', data: foundGdv });
  } else if (foundReports.length) {
    return res.json({ success: true, type: 'scam', data: foundReports });
  } else {
    return res.json({ success: true, type: 'unknown' });
  }
});

// ══ Health check (Render.com cần) ══
app.get('/health', (req, res) => res.json({ status: 'ok', time: Date.now() }));

// ══ Fallback: SPA-style cho các route HTML ══
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ AntiScam VN server đang chạy tại port ${PORT}`);
  console.log(`📁 Data lưu tại: ${DATA_DIR}`);
});

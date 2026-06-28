const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/db');
const notif    = require('../services/notificationService');

const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });

const genOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ══ USER REGISTER ═════════════════════════════════════════════
exports.userRegister = async (req, res) => {
  try {
    const { name, phone, password, date_of_birth, gender, whatsapp_no } = req.body;
    if (!name || !phone || !password || !date_of_birth)
      return res.status(400).json({ error: 'name, phone, password, date_of_birth required' });
    if (phone.length !== 10) return res.status(400).json({ error: 'Invalid phone number' });

    const exists = await pool.query('SELECT id FROM users WHERE phone=$1', [phone]);
    if (exists.rows.length) return res.status(409).json({ error: 'Phone already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, phone, password_hash, date_of_birth, gender, whatsapp_no)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, phone`,
      [name, phone, hash, date_of_birth, gender || null, whatsapp_no || null]
    );
    res.status(201).json({ message: 'Registered successfully', user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ USER LOGIN ════════════════════════════════════════════════
exports.userLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    const user = result.rows[0];
    if (!user || user.is_banned) return res.status(401).json({ error: 'Invalid credentials or account banned' });
    if (!user.is_active) return res.status(401).json({ error: 'Account deactivated' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = sign({ id: user.id, role: 'user', name: user.name, phone: user.phone });
    const { password_hash, ...userData } = user;
    res.json({ token, user: userData });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ PORTER REGISTER ═══════════════════════════════════════════
exports.porterRegister = async (req, res) => {
  try {
    const {
      name, phone, password, aadhaar_no, date_of_birth, gender, address,
      emergency_contact, blood_group, badge_no, station, shift_type,
      shift_start, shift_end, experience_years, upi_id, whatsapp_no
    } = req.body;

    const required = { name, phone, password, aadhaar_no, date_of_birth, badge_no, station, emergency_contact };
    for (const [k, v] of Object.entries(required)) {
      if (!v) return res.status(400).json({ error: `${k} is required` });
    }

    const [phoneEx, badgeEx, aadhaarEx] = await Promise.all([
      pool.query('SELECT id FROM porters WHERE phone=$1', [phone]),
      pool.query('SELECT id FROM porters WHERE badge_no=$1', [badge_no]),
      pool.query('SELECT id FROM porters WHERE aadhaar_no=$1', [aadhaar_no]),
    ]);
    if (phoneEx.rows.length)   return res.status(409).json({ error: 'Phone already registered' });
    if (badgeEx.rows.length)   return res.status(409).json({ error: 'Badge number already registered' });
    if (aadhaarEx.rows.length) return res.status(409).json({ error: 'Aadhaar number already registered' });

    // Get station city tier
    const stationRes = await pool.query('SELECT city_tier FROM stations WHERE name ILIKE $1 LIMIT 1', [station]);
    const cityTier = stationRes.rows[0]?.city_tier || 'y';

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO porters
         (name, phone, password_hash, aadhaar_no, date_of_birth, gender, address,
          emergency_contact, blood_group, badge_no, station, city_tier,
          shift_type, shift_start, shift_end, experience_years, upi_id, whatsapp_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id, name, phone, badge_no, station, status`,
      [name, phone, hash, aadhaar_no, date_of_birth, gender||null, address||null,
       emergency_contact, blood_group||null, badge_no, station, cityTier,
       shift_type||'8hr', shift_start||null, shift_end||null,
       experience_years||0, upi_id||null, whatsapp_no||null]
    );
    res.status(201).json({
      message: 'Registration submitted. Admin will verify and approve within 24–48 hours.',
      porter: result.rows[0]
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ PORTER LOGIN ══════════════════════════════════════════════
exports.porterLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const result = await pool.query(
      `SELECT id, name, phone, password_hash, status, is_active, station,
              city_tier, shift_type, shift_start, shift_end, rating,
              total_bookings, wallet_balance, fcm_token, is_online, is_on_job
       FROM porters WHERE phone=$1`, [phone]
    );
    const porter = result.rows[0];
    if (!porter || !porter.is_active)
      return res.status(401).json({ error: 'Invalid credentials or account inactive' });
    if (porter.status === 'pending')
      return res.status(403).json({ error: 'Account pending admin approval. Please wait 24–48 hours.' });
    if (porter.status === 'suspended')
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    const match = await bcrypt.compare(password, porter.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = sign({ id: porter.id, role: 'porter', name: porter.name, phone: porter.phone, station: porter.station });
    const { password_hash, ...porterData } = porter;
    res.json({ token, porter: porterData });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ ADMIN LOGIN ═══════════════════════════════════════════════
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM admins WHERE email=$1 AND is_active=TRUE', [email]);
    const admin = result.rows[0];
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    await pool.query('UPDATE admins SET last_login_at=NOW() WHERE id=$1', [admin.id]);
    const token = sign({ id: admin.id, role: 'admin', name: admin.name, email: admin.email });
    const { password_hash, ...adminData } = admin;
    res.json({ token, admin: adminData });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ VIEWER LOGIN ══════════════════════════════════════════════
exports.viewerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM viewers WHERE email=$1 AND is_active=TRUE', [email]);
    const viewer = result.rows[0];
    if (!viewer) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, viewer.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    await pool.query('UPDATE viewers SET last_login_at=NOW() WHERE id=$1', [viewer.id]);
    const token = sign({ id: viewer.id, role: 'viewer', name: viewer.name, email: viewer.email });
    const { password_hash, ...viewerData } = viewer;
    res.json({ token, viewer: viewerData });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ SEND OTP (for login or reset) ════════════════════════════
exports.sendOTP = async (req, res) => {
  try {
    const { identifier, purpose, role } = req.body;
    const otp = genOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await pool.query(
      `UPDATE otp_store SET used=TRUE WHERE identifier=$1 AND purpose=$2 AND used=FALSE`,
      [identifier, purpose]
    );
    await pool.query(
      `INSERT INTO otp_store (identifier, otp, purpose, role, expires_at) VALUES ($1,$2,$3,$4,$5)`,
      [identifier, otp, purpose, role || null, expiresAt]
    );

    // Send OTP
    if (identifier.includes('@')) {
      // Email OTP for admin/viewer — log for now
      console.log(`📧 Email OTP ${otp} → ${identifier}`);
    } else {
      await notif.sendOTP(identifier, otp);
    }

    res.json({
      message: `OTP sent to ${identifier.includes('@') ? identifier : '+91' + identifier.slice(0,2) + 'XXXXXXXX'}`,
      // In dev only:
      ...(process.env.NODE_ENV === 'development' ? { dev_otp: otp } : {})
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ VERIFY OTP ════════════════════════════════════════════════
exports.verifyOTP = async (req, res) => {
  try {
    const { identifier, otp, purpose } = req.body;
    const result = await pool.query(
      `SELECT * FROM otp_store
       WHERE identifier=$1 AND otp=$2 AND purpose=$3 AND used=FALSE AND expires_at>NOW()`,
      [identifier, otp, purpose]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired OTP' });
    await pool.query('UPDATE otp_store SET used=TRUE WHERE id=$1', [result.rows[0].id]);
    res.json({ verified: true, identifier });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ RESET PASSWORD ════════════════════════════════════════════
exports.resetPassword = async (req, res) => {
  try {
    const { identifier, new_password, role, verification_field } = req.body;
    // verification_field = aadhaar_no (porter) | date_of_birth (user) | pan_no+dob (admin/viewer)
    if (!new_password || new_password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    let table, whereClause, whereValues;
    if (role === 'porter') {
      table = 'porters';
      whereClause = 'phone=$1 AND aadhaar_no=$2';
      whereValues = [identifier, verification_field];
    } else if (role === 'user') {
      table = 'users';
      whereClause = 'phone=$1 AND date_of_birth=$2';
      whereValues = [identifier, verification_field];
    } else if (role === 'admin') {
      table = 'admins';
      whereClause = 'email=$1 AND pan_no=$2';
      whereValues = [identifier, verification_field];
    } else if (role === 'viewer') {
      table = 'viewers';
      whereClause = 'email=$1 AND pan_no=$2';
      whereValues = [identifier, verification_field];
    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const check = await pool.query(`SELECT id FROM ${table} WHERE ${whereClause}`, whereValues);
    if (!check.rows.length)
      return res.status(400).json({ error: 'Verification failed. Check your details.' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE ${table} SET password_hash=$1 WHERE id=$2`, [hash, check.rows[0].id]);
    res.json({ message: 'Password reset successfully. Please login.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ UPDATE FCM TOKEN ══════════════════════════════════════════
exports.updateFCMToken = async (req, res) => {
  try {
    const { fcm_token } = req.body;
    const { id, role } = req.user;
    const table = role === 'user' ? 'users' : 'porters';
    await pool.query(`UPDATE ${table} SET fcm_token=$1 WHERE id=$2`, [fcm_token, id]);
    res.json({ message: 'FCM token updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

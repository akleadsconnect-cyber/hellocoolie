const bcrypt   = require('bcryptjs');
const { pool } = require('../config/db');

// ══ DASHBOARD STATS ═══════════════════════════════════════════
exports.getStats = async (req, res) => {
  try {
    const [rev, bookings, porters, users, pending, fraud, disputes] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(platform_fee),0) as total, COALESCE(SUM(platform_fee) FILTER (WHERE DATE(created_at)=CURRENT_DATE),0) as today FROM bookings WHERE status='completed'`),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='completed') as completed, COUNT(*) FILTER (WHERE status='pending') as pending, COUNT(*) FILTER (WHERE DATE(created_at)=CURRENT_DATE) as today FROM bookings`),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='approved') as approved, COUNT(*) FILTER (WHERE status='pending') as pending, COUNT(*) FILTER (WHERE status='suspended') as suspended, COUNT(*) FILTER (WHERE is_online=TRUE) as online FROM porters`),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active=TRUE) as active, COUNT(*) FILTER (WHERE is_banned=TRUE) as banned FROM users`),
      pool.query(`SELECT COUNT(*) as count FROM fraud_flags WHERE reviewed_at IS NULL`),
      pool.query(`SELECT COUNT(*) as count FROM disputes WHERE status='open'`),
    ]);

    res.json({
      revenue: { total: parseFloat(rev.rows[0].total), today: parseFloat(rev.rows[0].today) },
      bookings: bookings.rows[0],
      porters: porters.rows[0],
      users: users.rows[0],
      pendingFraudAlerts: parseInt(pending.rows[0].count) + parseInt(fraud.rows[0].count),
      openDisputes: parseInt(disputes.rows[0].count),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ STATION WISE STATS ════════════════════════════════════════
exports.getStationStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.name, s.code, s.city, s.city_tier, s.category,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status='approved') as total_porters,
        COUNT(DISTINCT p.id) FILTER (WHERE p.is_online=TRUE) as online_porters,
        COUNT(DISTINCT b.id) as total_bookings,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status='completed') as completed_bookings,
        COALESCE(SUM(b.platform_fee) FILTER (WHERE b.status='completed'),0) as platform_revenue
      FROM stations s
      LEFT JOIN porters p ON p.station = s.name
      LEFT JOIN bookings b ON b.arrival_station = s.name
      WHERE s.is_active = TRUE
      GROUP BY s.id ORDER BY platform_revenue DESC`
    );
    res.json({ stations: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ PORTER MANAGEMENT ════════════════════════════════════════
exports.getPorters = async (req, res) => {
  try {
    const { filter = 'all', station, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (filter === 'pending')   { where += ` AND status='pending'`; }
    if (filter === 'approved')  { where += ` AND status='approved'`; }
    if (filter === 'suspended') { where += ` AND status='suspended'`; }
    if (filter === 'inactive')  { where += ` AND is_active=FALSE`; }
    if (filter === 'fraud')     { where += ` AND fraud_flag_count > 0`; }
    if (station) { params.push(station); where += ` AND station=$${params.length}`; }
    if (search)  { params.push(`%${search}%`); where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length} OR badge_no ILIKE $${params.length})`; }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT id, name, phone, badge_no, station, city_tier, shift_type, status,
              is_online, is_on_job, rating, total_bookings, total_cancellations,
              fraud_flag_count, wallet_balance, experience_years, created_at, approved_at
       FROM porters ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ porters: result.rows, page: parseInt(page) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.approvePorter = async (req, res) => {
  try {
    await pool.query(
      `UPDATE porters SET status='approved', approved_by=$1, approved_at=NOW() WHERE id=$2`,
      [req.user.id, req.params.id]
    );
    await pool.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id)
       VALUES ($1,'admin','approve_porter','porter',$2)`, [req.user.id, req.params.id]
    );
    res.json({ message: 'Porter approved. They can now login and go online.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.suspendPorter = async (req, res) => {
  try {
    const { reason } = req.body;
    await pool.query(
      `UPDATE porters SET status='suspended', suspended_by=$1, suspended_at=NOW(),
         suspend_reason=$2, is_online=FALSE WHERE id=$3`,
      [req.user.id, reason || 'Suspended by admin', req.params.id]
    );
    await pool.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id, details)
       VALUES ($1,'admin','suspend_porter','porter',$2,$3)`,
      [req.user.id, req.params.id, JSON.stringify({ reason })]
    );
    res.json({ message: 'Porter suspended' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.reactivatePorter = async (req, res) => {
  try {
    await pool.query(
      `UPDATE porters SET status='approved', is_active=TRUE WHERE id=$1`, [req.params.id]
    );
    res.json({ message: 'Porter reactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ USER MANAGEMENT ══════════════════════════════════════════
exports.getUsers = async (req, res) => {
  try {
    const { filter = 'active', search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = "WHERE 1=1";
    const params = [];
    if (filter === 'active')   where += ' AND is_active=TRUE AND is_banned=FALSE';
    if (filter === 'inactive') where += ' AND is_active=FALSE';
    if (filter === 'banned')   where += ' AND is_banned=TRUE';
    if (search) { params.push(`%${search}%`); where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`; }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT id, name, phone, gender, is_senior, is_active, is_banned,
              total_bookings, created_at
       FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ users: result.rows, page: parseInt(page) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.banUser = async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_banned=TRUE WHERE id=$1', [req.params.id]);
    res.json({ message: 'User banned' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.unbanUser = async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_banned=FALSE, is_active=TRUE WHERE id=$1', [req.params.id]);
    res.json({ message: 'User unbanned' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ ALL BOOKINGS ══════════════════════════════════════════════
exports.getAllBookings = async (req, res) => {
  try {
    const { status, station, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (status)    { params.push(status);    where += ` AND b.status=$${params.length}`; }
    if (station)   { params.push(station);   where += ` AND b.arrival_station=$${params.length}`; }
    if (from_date) { params.push(from_date); where += ` AND b.created_at>=$${params.length}`; }
    if (to_date)   { params.push(to_date);   where += ` AND b.created_at<=$${params.length}`; }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT b.id, b.user_id, b.porter_id, b.traveller_name, b.porter_name,
              b.arrival_station, b.train_no, b.coach, b.seat_no,
              b.bag_count, b.bag_weight, b.total_amount, b.platform_fee,
              b.porter_amount, b.payment_method, b.payment_status, b.status,
              b.city_tier, b.season_type, b.created_at, b.completed_at,
              b.cancel_fee, b.cancelled_by
       FROM bookings b ${where}
       ORDER BY b.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ bookings: result.rows, page: parseInt(page) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ FRAUD FLAGS ═══════════════════════════════════════════════
exports.getFraudFlags = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, p.name as porter_name, p.phone as porter_phone, p.station
       FROM fraud_flags f
       JOIN porters p ON f.porter_id = p.id
       WHERE f.reviewed_at IS NULL
       ORDER BY f.created_at DESC`
    );
    res.json({ flags: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.reviewFraudFlag = async (req, res) => {
  try {
    const { action_taken } = req.body;
    await pool.query(
      `UPDATE fraud_flags SET reviewed_by=$1, reviewed_at=NOW(), action_taken=$2 WHERE id=$3`,
      [req.user.id, action_taken, req.params.id]
    );
    res.json({ message: 'Fraud flag reviewed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ SURGE PRICING MANAGEMENT ══════════════════════════════════
exports.getSurgeConfigs = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surge_config ORDER BY start_date DESC');
    res.json({ configs: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createSurgeConfig = async (req, res) => {
  try {
    const { name, start_date, end_date, season_type, platform_fee_pct, base_fare_override } = req.body;
    const result = await pool.query(
      `INSERT INTO surge_config (name, start_date, end_date, season_type, platform_fee_pct, base_fare_override, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, start_date, end_date, season_type||'festival', platform_fee_pct||25, base_fare_override||null, req.user.id]
    );
    res.status(201).json({ config: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ CREATE VIEWER ═════════════════════════════════════════════
exports.createViewer = async (req, res) => {
  try {
    const { name, email, pan_no, date_of_birth, password } = req.body;
    const exists = await pool.query('SELECT id FROM viewers WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO viewers (name, email, pan_no, date_of_birth, password_hash, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email`,
      [name, email, pan_no, date_of_birth, hash, req.user.id]
    );
    res.status(201).json({ viewer: result.rows[0], message: 'Viewer account created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ OFFLINE FEE RECOVERY LIST ═════════════════════════════════
exports.getOfflineFeesPending = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.porter_name, b.arrival_station, b.platform_fee, b.completed_at,
              p.wallet_balance, p.phone as porter_phone
       FROM bookings b JOIN porters p ON b.porter_id = p.id
       WHERE b.payment_method='cash' AND b.status='completed'
         AND b.offline_fee_recovered=FALSE
       ORDER BY b.completed_at DESC`
    );
    res.json({ pending: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

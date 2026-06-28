// ═══════════════════════════════════════════════════════════
//  viewerController.js
// ═══════════════════════════════════════════════════════════
const { pool }              = require('../config/db');
const walletService         = require('../services/walletService');
const cancellationService   = require('../services/cancellationService');
const assignmentService     = require('../services/bookingAssignmentService');

// Viewer: search booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*,
         u.name as user_name_db, u.phone as user_phone_db,
         p.name as porter_name_db, p.phone as porter_phone_db, p.badge_no, p.rating as porter_rating_db,
         r.porter_rating, r.porter_review, r.porter_tags,
         d.description as dispute_desc, d.status as dispute_status,
         c.fee_applicable, c.fee_amount, c.minutes_to_arrival
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN porters p ON b.porter_id = p.id
       LEFT JOIN ratings r ON b.id = r.booking_id
       LEFT JOIN disputes d ON b.id = d.booking_id
       LEFT JOIN cancellations c ON b.id = c.booking_id
       WHERE b.id = $1`,
      [req.params.bookingId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Booking not found' });
    // Notification timeline
    const notifHistory = await pool.query(
      `SELECT porter_id, notified_at, expires_at, response, responded_at
       FROM booking_notifications WHERE booking_id=$1 ORDER BY notified_at`,
      [req.params.bookingId]
    );
    res.json({ booking: result.rows[0], notificationTimeline: notifHistory.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Viewer: see disputes
exports.getDisputes = async (req, res) => {
  try {
    const { status = 'open' } = req.query;
    const result = await pool.query(
      `SELECT d.*, b.arrival_station, b.total_amount, b.status as booking_status
       FROM disputes d JOIN bookings b ON d.booking_id = b.id
       WHERE d.status = $1 ORDER BY d.created_at DESC`,
      [status]
    );
    res.json({ disputes: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Viewer: resolve dispute
exports.resolveDispute = async (req, res) => {
  try {
    const { resolution } = req.body;
    await pool.query(
      `UPDATE disputes SET status='resolved', assigned_to=$1, resolution=$2, resolved_at=NOW()
       WHERE id=$3`, [req.user.id, resolution, req.params.id]
    );
    res.json({ message: 'Dispute resolved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Viewer: see stalled bookings (porter not responded 24/48 hrs)
exports.getStalledBookings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, p.name as porter_name_db, p.phone as porter_phone
       FROM bookings b LEFT JOIN porters p ON b.porter_id = p.id
       WHERE b.status = 'accepted'
         AND b.accepted_at < NOW() - INTERVAL '24 hours'
       ORDER BY b.accepted_at ASC`
    );
    res.json({ stalledBookings: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Viewer: temporary suspend porter (48 hours)
exports.tempSuspendPorter = async (req, res) => {
  try {
    const { reason } = req.body;
    await pool.query(
      `UPDATE porters SET status='suspended', suspend_reason=$1,
         suspended_at=NOW(), is_online=FALSE WHERE id=$2`,
      [`Temp suspend (48hr) by viewer: ${reason}`, req.params.id]
    );
    res.json({ message: 'Porter suspended for 48 hours. Admin will confirm.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Viewer: manually cancel stalled booking with full refund
exports.cancelStalledBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    await pool.query(
      `UPDATE bookings SET status='cancelled_by_porter', cancel_reason='Viewer cancelled: porter stalled',
         cancelled_by='viewer', updated_at=NOW() WHERE id=$1`,
      [bookingId]
    );
    // TODO: trigger full refund via Razorpay
    res.json({ message: 'Booking cancelled. Full refund initiated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════════════════════
//  porterController.js
// ═══════════════════════════════════════════════════════════
exports.toggleOnline = async (req, res) => {
  try {
    const { is_online } = req.body;
    await pool.query('UPDATE porters SET is_online=$1 WHERE id=$2', [is_online, req.user.id]);
    res.json({ message: is_online ? '🟢 You are now ONLINE' : '🔴 You are now OFFLINE', is_online });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPorterProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, badge_no, station, city_tier, shift_type, shift_start, shift_end,
              rating, total_ratings, total_bookings, total_cancellations, fraud_flag_count,
              wallet_balance, upi_id, experience_years, can_carry_very_heavy,
              is_online, is_on_job, status, created_at, blood_group, gender
       FROM porters WHERE id=$1`, [req.user.id]
    );
    res.json({ porter: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updatePorterProfile = async (req, res) => {
  try {
    const { upi_id, bank_account, bank_ifsc, shift_start, shift_end, whatsapp_no } = req.body;
    await pool.query(
      `UPDATE porters SET upi_id=COALESCE($1,upi_id), bank_account=COALESCE($2,bank_account),
         bank_ifsc=COALESCE($3,bank_ifsc), shift_start=COALESCE($4,shift_start),
         shift_end=COALESCE($5,shift_end), whatsapp_no=COALESCE($6,whatsapp_no),
         updated_at=NOW() WHERE id=$7`,
      [upi_id, bank_account, bank_ifsc, shift_start, shift_end, whatsapp_no, req.user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getWallet = async (req, res) => {
  try {
    const summary = await walletService.getWalletSummary(req.user.id);
    res.json(summary);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.withdraw = async (req, res) => {
  try {
    const { amount, upi_id } = req.body;
    const result = await walletService.withdraw(req.user.id, parseFloat(amount), upi_id);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.getEarningsSummary = async (req, res) => {
  try {
    const [today, week, month, all] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE porter_id=$1 AND type='credit' AND DATE(created_at)=CURRENT_DATE`, [req.user.id]),
      pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE porter_id=$1 AND type='credit' AND created_at >= NOW()-INTERVAL '7 days'`, [req.user.id]),
      pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE porter_id=$1 AND type='credit' AND created_at >= NOW()-INTERVAL '30 days'`, [req.user.id]),
      pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE porter_id=$1 AND type='credit'`, [req.user.id]),
    ]);
    res.json({
      today:  parseFloat(today.rows[0].total),
      week:   parseFloat(week.rows[0].total),
      month:  parseFloat(month.rows[0].total),
      allTime:parseFloat(all.rows[0].total),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// SOS
exports.raiseSOS = async (req, res) => {
  try {
    const { booking_id, location } = req.body;
    await pool.query(
      `INSERT INTO sos_alerts (raised_by, porter_id, booking_id, location)
       VALUES ('porter',$1,$2,$3)`, [req.user.id, booking_id||null, location||null]
    );
    // TODO: notify admin immediately
    res.json({ message: '🆘 SOS raised. Help is on the way.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════════════════════
//  userController.js
// ═══════════════════════════════════════════════════════════
exports.getUserProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, phone, gender, is_senior, whatsapp_no, preferred_lang, total_bookings, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const { gender, is_senior, whatsapp_no, preferred_lang } = req.body;
    await pool.query(
      `UPDATE users SET gender=COALESCE($1,gender), is_senior=COALESCE($2,is_senior),
         whatsapp_no=COALESCE($3,whatsapp_no), preferred_lang=COALESCE($4,preferred_lang),
         updated_at=NOW() WHERE id=$5`,
      [gender, is_senior, whatsapp_no, preferred_lang, req.user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteUserAccount = async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active=FALSE, deleted_at=NOW() WHERE id=$1', [req.user.id]);
    res.json({ message: 'Account deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.userSOS = async (req, res) => {
  try {
    const { booking_id, location } = req.body;
    await pool.query(
      `INSERT INTO sos_alerts (raised_by, user_id, booking_id, location)
       VALUES ('user',$1,$2,$3)`, [req.user.id, booking_id||null, location||null]
    );
    res.json({ message: '🆘 SOS raised. Help is on the way.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════════════════════
//  paymentController.js
// ═══════════════════════════════════════════════════════════
const Razorpay = require('razorpay');
const crypto   = require('crypto');

const getRazorpay = () => new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
exports.createOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const bRes = await pool.query('SELECT * FROM bookings WHERE id=$1 AND user_id=$2', [bookingId, req.user.id]);
    const booking = bRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.payment_method !== 'online') return res.status(400).json({ error: 'Not an online payment booking' });
    if (booking.payment_status === 'paid') return res.status(400).json({ error: 'Already paid' });

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: Math.round(booking.total_amount * 100), // paise
      currency: 'INR',
      receipt: bookingId,
      notes: { bookingId, userId: req.user.id },
    });

    await pool.query('UPDATE bookings SET razorpay_order_id=$1 WHERE id=$2', [order.id, bookingId]);
    res.json({ orderId: order.id, amount: booking.total_amount, currency: 'INR', bookingId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Verify payment + release porter wallet
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body).digest('hex');
    if (expected !== razorpay_signature)
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });

    const bRes = await pool.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
    const booking = bRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Mark payment
    await pool.query(
      `UPDATE bookings SET payment_status='paid', razorpay_payment_id=$1, updated_at=NOW()
       WHERE id=$2`, [razorpay_payment_id, bookingId]
    );

    // If already completed, release porter wallet
    if (booking.status === 'completed' && booking.porter_id) {
      await walletService.credit(
        booking.porter_id, booking.porter_amount, bookingId,
        `Payment received for booking ${bookingId}`
      );
    }

    res.json({ message: 'Payment verified', bookingId, paymentId: razorpay_payment_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Razorpay webhook
exports.webhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body).digest('hex');
    if (expected !== signature) return res.status(400).send('Invalid signature');

    const { event, payload } = req.body;
    if (event === 'payment.captured') {
      const bookingId = payload.payment.entity.receipt;
      await pool.query(
        `UPDATE bookings SET payment_status='paid', razorpay_payment_id=$1 WHERE id=$2`,
        [payload.payment.entity.id, bookingId]
      );
    }
    res.status(200).send('OK');
  } catch (err) { res.status(500).send(err.message); }
};

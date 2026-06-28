const { pool }           = require('../config/db');
const pricingService     = require('../services/pricingService');
const assignmentService  = require('../services/bookingAssignmentService');
const cancellationService= require('../services/cancellationService');
const walletService      = require('../services/walletService');
const notif              = require('../services/notificationService');

const generateBookingId = () =>
  'BK' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 100);

// ══ GET FARE PREVIEW ══════════════════════════════════════════
// Called before booking — user sees full breakdown
exports.getFarePreview = async (req, res) => {
  try {
    const { city_tier, bag_count, bag_weight, drop_location } = req.query;
    const fare = await pricingService.calculateFare({
      cityTier: city_tier || 'y',
      bagCount: parseInt(bag_count) || 1,
      bagWeight: bag_weight || 'normal',
      dropLocation: drop_location || 'platform',
    });
    res.json({ fare });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ CREATE BOOKING ════════════════════════════════════════════
exports.createBooking = async (req, res) => {
  try {
    const {
      booking_for, traveller_name, traveller_phone, traveller_age, traveller_gender,
      is_senior, is_woman_solo,
      train_no, train_name, from_station, to_station, arrival_station, arrival_time,
      coach, seat_no, pnr,
      bag_count, bag_weight, bag_details, drop_location,
      two_porter_accepted, payment_method,
    } = req.body;

    if (!traveller_name || !traveller_phone || !arrival_station || !bag_count)
      return res.status(400).json({ error: 'Required fields missing' });

    // Get station city tier
    const stationRes = await pool.query(
      'SELECT city_tier FROM stations WHERE name ILIKE $1 LIMIT 1', [arrival_station]
    );
    const cityTier = stationRes.rows[0]?.city_tier || 'y';

    // Calculate fare
    const fare = await pricingService.calculateFare({
      cityTier, bagCount: parseInt(bag_count),
      bagWeight: bag_weight || 'normal',
      dropLocation: drop_location || 'platform',
    });

    const bookingId = generateBookingId();

    await pool.query(
      `INSERT INTO bookings (
         id, user_id, booking_for, traveller_name, traveller_phone, traveller_age,
         traveller_gender, is_senior, is_woman_solo,
         train_no, train_name, from_station, to_station, arrival_station, arrival_time,
         coach, seat_no, pnr,
         bag_count, bag_weight, bag_details, drop_location,
         two_porter_suggested, two_porter_accepted,
         city_tier, season_type, base_fare, bag_fare, distance_fare,
         platform_fee_pct, platform_fee, porter_amount, total_amount, subtotal,
         payment_method, status
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
         $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,'pending'
       )`,
      [
        bookingId, req.user.id, booking_for || 'myself',
        traveller_name, traveller_phone, traveller_age || null,
        traveller_gender || null, is_senior || false, is_woman_solo || false,
        train_no || null, train_name || null, from_station || null, to_station || null,
        arrival_station, arrival_time || null, coach || null, seat_no || null, pnr || null,
        parseInt(bag_count), bag_weight || 'normal', bag_details || null, drop_location || 'platform',
        fare.twoPorterSuggested, two_porter_accepted || false,
        cityTier, fare.seasonType,
        fare.baseFare, fare.bagFare, fare.distanceFare,
        fare.platformFeePct, fare.platformFee, fare.porterAmount, fare.totalAmount, fare.subtotal,
        payment_method || 'online',
      ]
    );

    // Update user booking count
    await pool.query('UPDATE users SET total_bookings=total_bookings+1 WHERE id=$1', [req.user.id]);

    // Get io from app and start round-robin assignment
    const io = req.app.get('io');
    assignmentService.notifyNextPorter(bookingId, io);

    res.status(201).json({
      bookingId,
      fare,
      status: 'pending',
      message: 'Booking created. Finding porter...',
      twoPorterSuggested: fare.twoPorterSuggested,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ PORTER ACCEPT ═════════════════════════════════════════════
exports.acceptBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const io = req.app.get('io');
    const result = await assignmentService.acceptBooking(bookingId, req.user.id, io);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ══ PORTER REJECT ═════════════════════════════════════════════
exports.rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const io = req.app.get('io');
    await assignmentService.rejectBooking(bookingId, req.user.id, io);
    res.json({ message: 'Booking rejected' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ══ VERIFY OTP (job start) ════════════════════════════════════
exports.verifyJobOTP = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { otp } = req.body;
    const io = req.app.get('io');
    const result = await assignmentService.verifyJobOTP(bookingId, req.user.id, otp, io);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ══ COMPLETE JOB ══════════════════════════════════════════════
exports.completeJob = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const bRes = await pool.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
    const booking = bRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.porter_id.toString() !== req.user.id)
      return res.status(403).json({ error: 'Not your booking' });
    if (booking.status !== 'in_progress')
      return res.status(400).json({ error: 'Job not in progress' });

    await pool.query(
      `UPDATE bookings SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [bookingId]
    );
    await pool.query('UPDATE porters SET is_on_job=FALSE, total_bookings=total_bookings+1 WHERE id=$1', [req.user.id]);

    // Online payment: credit porter wallet instantly
    if (booking.payment_method === 'online' && booking.payment_status === 'paid') {
      await walletService.credit(
        req.user.id, booking.porter_amount, bookingId,
        `Booking ${bookingId} completed — ₹${booking.porter_amount}`
      );
    } else if (booking.payment_method === 'cash') {
      // Cash: porter received cash. Platform fee recovery needed.
      // Attempt wallet deduction if balance exists
      try {
        await walletService.recoverOfflineFee(bookingId);
      } catch {
        // Log for manual recovery
        console.log(`⚠️ Offline fee recovery pending for booking ${bookingId}`);
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.user_id}`).emit('job_completed', {
        bookingId,
        message: 'Job done! Please rate your porter.',
      });
    }

    res.json({ message: 'Job marked as complete', bookingId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ CANCEL BOOKING ════════════════════════════════════════════
exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const cancelledBy = req.user.role === 'user' ? 'user' : 'porter';

    const result = await cancellationService.cancelBooking(bookingId, cancelledBy, reason);

    const io = req.app.get('io');
    const bRes = await pool.query('SELECT user_id, porter_id FROM bookings WHERE id=$1', [bookingId]);
    const booking = bRes.rows[0];

    if (io && cancelledBy === 'porter' && booking.user_id) {
      io.to(`user_${booking.user_id}`).emit('booking_cancelled_by_porter', {
        bookingId,
        message: 'Porter cancelled. Finding another porter...',
        feeCharged: result.cancelFee,
      });
      // Try to find next porter
      if (['pending', 'accepted'].includes((await pool.query('SELECT status FROM bookings WHERE id=$1', [bookingId])).rows[0].status)) {
        assignmentService.notifyNextPorter(bookingId, io);
      }
    }

    res.json({
      message: 'Booking cancelled',
      feeApplicable: result.feeApplicable,
      cancelFee: result.cancelFee,
      minutesToArrival: result.minsLeft,
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ══ SUBMIT RATING ═════════════════════════════════════════════
exports.submitRating = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { porter_rating, porter_review, porter_tags, user_rating, user_tags } = req.body;

    const bRes = await pool.query("SELECT * FROM bookings WHERE id=$1 AND status='completed'", [bookingId]);
    if (!bRes.rows.length) return res.status(400).json({ error: 'Booking not found or not completed' });
    const booking = bRes.rows[0];

    await pool.query(
      `INSERT INTO ratings (booking_id, user_id, porter_id, porter_rating, porter_review, porter_tags, user_rating, user_tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (booking_id) DO UPDATE SET
         porter_rating=$4, porter_review=$5, porter_tags=$6, user_rating=$7, user_tags=$8`,
      [bookingId, booking.user_id, booking.porter_id,
       porter_rating||null, porter_review||null, porter_tags||null,
       user_rating||null, user_tags||null]
    );

    // Update porter avg rating
    if (porter_rating) {
      const rRes = await pool.query(
        'SELECT AVG(porter_rating) as avg, COUNT(*) as cnt FROM ratings WHERE porter_id=$1 AND porter_rating IS NOT NULL',
        [booking.porter_id]
      );
      await pool.query(
        'UPDATE porters SET rating=$1, total_ratings=$2 WHERE id=$3',
        [parseFloat(rRes.rows[0].avg).toFixed(2), rRes.rows[0].cnt, booking.porter_id]
      );
    }

    res.json({ message: 'Rating submitted. Thank you!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ GET MY BOOKINGS (user) ════════════════════════════════════
exports.getMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where  = status ? `AND status = '${status}'` : '';
    const result = await pool.query(
      `SELECT b.*, r.porter_rating, r.porter_review, r.porter_tags
       FROM bookings b
       LEFT JOIN ratings r ON b.id = r.booking_id
       WHERE b.user_id=$1 ${where}
       ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ bookings: result.rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ GET PORTER BOOKINGS ═══════════════════════════════════════
exports.getPorterBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where  = status ? `AND b.status = '${status}'` : '';
    const [active, history] = await Promise.all([
      pool.query(
        `SELECT * FROM bookings WHERE porter_id=$1 AND status IN ('accepted','in_progress') ORDER BY created_at DESC`,
        [req.user.id]
      ),
      pool.query(
        `SELECT b.*, r.user_rating FROM bookings b
         LEFT JOIN ratings r ON b.id = r.booking_id
         WHERE b.porter_id=$1 ${where}
         ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      ),
    ]);
    res.json({ active: active.rows, history: history.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ══ RAISE DISPUTE ═════════════════════════════════════════════
exports.raiseDispute = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { description } = req.body;
    const raisedBy = req.user.role;
    const bRes = await pool.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
    const booking = bRes.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    await pool.query(
      `INSERT INTO disputes (booking_id, raised_by, user_id, porter_id, description)
       VALUES ($1,$2,$3,$4,$5)`,
      [bookingId, raisedBy, booking.user_id, booking.porter_id, description]
    );
    await pool.query(
      `UPDATE bookings SET status='disputed', updated_at=NOW() WHERE id=$1`, [bookingId]
    );
    res.status(201).json({ message: 'Dispute raised. Viewer team will investigate within 2 hours.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

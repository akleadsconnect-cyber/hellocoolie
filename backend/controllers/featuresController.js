// ═══════════════════════════════════════════════════════════
//  controllers/featuresController.js
//  Trolley, Group Booking, Scheduled, Earnings, SOS, Dispute, i18n
// ═══════════════════════════════════════════════════════════

const { pool } = require('../config/db');
const {
  trolleyService,
  groupBookingService,
  scheduledBookingService,
  earningsAnalytics,
  sosService,
  disputeService,
  i18nService,
} = require('../services/missingFeatures');

// ════════════════════════════════════════════════════════════
// TROLLEY
// ════════════════════════════════════════════════════════════

// User: check if station has trolley before booking
exports.getStationTrolleyInfo = async (req, res) => {
  try {
    const { station } = req.query;
    if (!station) return res.status(400).json({ error: 'station required' });
    const info = await trolleyService.getStationTrolleyInfo(station);
    res.json({ station, ...info });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Porter: offer trolley to user during active booking
exports.offerTrolley = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { trolley_charge } = req.body;
    if (!trolley_charge || trolley_charge <= 0)
      return res.status(400).json({ error: 'Valid trolley_charge required' });

    const result = await trolleyService.offerTrolley(bookingId, req.user.id, parseFloat(trolley_charge));

    // Notify user via socket
    const bRes = await pool.query('SELECT user_id FROM bookings WHERE id=$1', [bookingId]);
    const io = req.app.get('io');
    if (io && bRes.rows[0]) {
      io.to(`user_${bRes.rows[0].user_id}`).emit('trolley_offer', {
        bookingId,
        trolleyCharge: trolley_charge,
        message: `Porter is offering trolley service for ₹${trolley_charge} extra. Accept?`,
      });
    }
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// User: accept or decline trolley offer
exports.respondToTrolley = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { accepted } = req.body;
    const result = await trolleyService.respondToTrolley(bookingId, req.user.id, accepted);

    // Notify porter of response
    const bRes = await pool.query('SELECT porter_id, trolley_charge FROM bookings WHERE id=$1', [bookingId]);
    const io = req.app.get('io');
    if (io && bRes.rows[0]?.porter_id) {
      io.to(`porter_${bRes.rows[0].porter_id}`).emit('trolley_response', {
        bookingId, accepted,
        message: accepted
          ? `✅ User accepted trolley. ₹${bRes.rows[0].trolley_charge} added to your fare.`
          : '❌ User declined trolley service.',
      });
    }
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ════════════════════════════════════════════════════════════
// GROUP BOOKING
// ════════════════════════════════════════════════════════════

// Triggered automatically when bag_count >= 5 and user accepts 2-porter suggestion
exports.initiateGroupBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Verify ownership
    const bRes = await pool.query(
      'SELECT * FROM bookings WHERE id=$1 AND user_id=$2', [bookingId, req.user.id]
    );
    if (!bRes.rows.length) return res.status(404).json({ error: 'Booking not found' });
    if (bRes.rows[0].bag_count < 5)
      return res.status(400).json({ error: 'Group booking only for 5+ bags' });

    const io = req.app.get('io');
    const result = await groupBookingService.createGroupBooking(bookingId, io);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// Porter responds to group booking request
exports.respondGroupBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { accepted } = req.body;
    const io = req.app.get('io');
    const result = await groupBookingService.respondGroupBooking(bookingId, req.user.id, accepted);

    if (result.status === 'both_accepted') {
      // Notify user
      const bRes = await pool.query('SELECT user_id FROM bookings WHERE id=$1', [bookingId]);
      if (io && bRes.rows[0]) {
        io.to(`user_${bRes.rows[0].user_id}`).emit('group_booking_confirmed', {
          bookingId,
          message: '✅ Both porters confirmed! They will handle your luggage together.',
        });
      }
    }
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ════════════════════════════════════════════════════════════
// PRE-SCHEDULED BOOKING
// ════════════════════════════════════════════════════════════

// User schedules a booking up to 2 hours in advance
exports.scheduleBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { scheduled_for } = req.body;
    if (!scheduled_for) return res.status(400).json({ error: 'scheduled_for datetime required' });

    // Verify ownership
    const bRes = await pool.query(
      'SELECT id FROM bookings WHERE id=$1 AND user_id=$2', [bookingId, req.user.id]
    );
    if (!bRes.rows.length) return res.status(404).json({ error: 'Booking not found' });

    const result = await scheduledBookingService.scheduleBooking(bookingId, scheduled_for);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// Get user's scheduled (upcoming) bookings
exports.getScheduledBookings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bookings
       WHERE user_id=$1 AND is_scheduled=TRUE AND schedule_status IN ('scheduled','dispatched')
       ORDER BY scheduled_for ASC`,
      [req.user.id]
    );
    res.json({ scheduledBookings: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Cancel a scheduled booking before dispatch
exports.cancelScheduledBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const bRes = await pool.query(
      `SELECT * FROM bookings WHERE id=$1 AND user_id=$2 AND is_scheduled=TRUE`, [bookingId, req.user.id]
    );
    if (!bRes.rows.length) return res.status(404).json({ error: 'Scheduled booking not found' });
    if (bRes.rows[0].schedule_status === 'dispatched')
      return res.status(400).json({ error: 'Booking already dispatched. Use normal cancel.' });

    await pool.query(
      `UPDATE bookings SET status='cancelled_by_user', schedule_status='expired',
         cancel_reason='User cancelled scheduled booking', updated_at=NOW() WHERE id=$1`,
      [bookingId]
    );
    res.json({ message: 'Scheduled booking cancelled. No charge applies.' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ════════════════════════════════════════════════════════════
// PORTER EARNINGS ANALYTICS
// ════════════════════════════════════════════════════════════

exports.getPorterEarningsAnalytics = async (req, res) => {
  try {
    const data = await earningsAnalytics.getDetailedEarnings(req.user.id);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin view: porter earnings report
exports.getPorterEarningsAdmin = async (req, res) => {
  try {
    const { porterId } = req.params;
    const data = await earningsAnalytics.getDetailedEarnings(porterId);

    // Also get station-level stats for this porter
    const stationStats = await pool.query(
      `SELECT arrival_station as station,
              COUNT(*) as bookings,
              COALESCE(SUM(porter_amount),0) as earnings
       FROM bookings WHERE porter_id=$1 AND status='completed'
       GROUP BY arrival_station ORDER BY earnings DESC`,
      [porterId]
    );

    res.json({ ...data, stationBreakdown: stationStats.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ════════════════════════════════════════════════════════════
// SOS — Full implementation with admin alert
// ════════════════════════════════════════════════════════════

exports.userSOS = async (req, res) => {
  try {
    const { booking_id, latitude, longitude } = req.body;
    const result = await sosService.raiseSOS({
      raisedBy: 'user',
      userId: req.user.id,
      bookingId: booking_id || null,
      latitude, longitude,
    });

    // Alert all admins + viewers via socket immediately
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('sos_alert', {
        type: 'user',
        userId: req.user.id,
        userName: req.user.name,
        bookingId: booking_id,
        location: latitude ? { lat: latitude, lng: longitude } : null,
        mapsLink: latitude ? `https://maps.google.com/?q=${latitude},${longitude}` : null,
        message: `🆘 USER SOS from ${req.user.name}!`,
        time: new Date().toISOString(),
      });
    }

    res.json({
      message: '🆘 SOS raised. Emergency contact notified. Help is on the way.',
      sosId: result.sosId,
      emergencyNotified: result.emergencyNotified,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.porterSOS = async (req, res) => {
  try {
    const { booking_id, latitude, longitude } = req.body;
    const result = await sosService.raiseSOS({
      raisedBy: 'porter',
      porterId: req.user.id,
      bookingId: booking_id || null,
      latitude, longitude,
    });

    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('sos_alert', {
        type: 'porter',
        porterId: req.user.id,
        porterName: req.user.name,
        bookingId: booking_id,
        location: latitude ? { lat: latitude, lng: longitude } : null,
        mapsLink: latitude ? `https://maps.google.com/?q=${latitude},${longitude}` : null,
        message: `🆘 PORTER SOS from ${req.user.name}!`,
        time: new Date().toISOString(),
      });
    }

    res.json({
      message: '🆘 SOS raised. Emergency contact notified. Admin alerted.',
      sosId: result.sosId,
      emergencyNotified: result.emergencyNotified,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getActiveSOS = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*,
              u.name as user_name, u.phone as user_phone,
              p.name as porter_name, p.phone as porter_phone, p.emergency_contact,
              b.arrival_station, b.train_no, b.coach
       FROM sos_alerts s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN porters p ON s.porter_id = p.id
       LEFT JOIN bookings b ON s.booking_id = b.id
       WHERE s.status='active'
       ORDER BY s.created_at DESC`
    );
    res.json({ activeSOS: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.resolveSOS = async (req, res) => {
  try {
    await sosService.resolveSOS(req.params.id, req.user.id);
    const io = req.app.get('io');
    if (io) io.to('admin_room').emit('sos_resolved', { sosId: req.params.id });
    res.json({ message: 'SOS marked as resolved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ════════════════════════════════════════════════════════════
// DISPUTE — Full with SLA tracking
// ════════════════════════════════════════════════════════════

exports.raiseDispute = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { description } = req.body;
    if (!description || description.trim().length < 10)
      return res.status(400).json({ error: 'Please provide a clear description (min 10 chars)' });

    // Verify booking belongs to user/porter
    const bRes = await pool.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
    if (!bRes.rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = bRes.rows[0];

    const raisedBy = req.user.role;
    const result = await disputeService.createDispute({
      bookingId,
      raisedBy,
      userId:   booking.user_id,
      porterId: booking.porter_id,
      description,
    });

    // Alert admin room via socket
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('new_dispute', {
        disputeId:  result.disputeId,
        bookingId,
        raisedBy,
        slaDeadline: result.slaDeadline,
        message: `⚠️ New dispute raised by ${raisedBy} on booking ${bookingId}. SLA: 2 hours.`,
      });
    }

    res.status(201).json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDisputes = async (req, res) => {
  try {
    const { status = 'open', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const result = await pool.query(
      `SELECT d.*,
              b.arrival_station, b.total_amount, b.status as booking_status,
              b.train_no, b.bag_count,
              u.name as user_name, u.phone as user_phone,
              p.name as porter_name, p.phone as porter_phone,
              v.name as assigned_viewer_name,
              CASE WHEN d.sla_deadline < NOW() AND d.status='open' THEN TRUE ELSE FALSE END as sla_breached_now
       FROM disputes d
       JOIN bookings b ON d.booking_id = b.id
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN porters p ON d.porter_id = p.id
       LEFT JOIN viewers v ON d.assigned_to = v.id
       WHERE d.status = $1
       ORDER BY d.sla_breached DESC, d.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    res.json({ disputes: result.rows, page: parseInt(page) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.resolveDispute = async (req, res) => {
  try {
    const { resolution, refund_user, penalise_porter } = req.body;
    if (!resolution) return res.status(400).json({ error: 'Resolution description required' });

    const dRes = await pool.query('SELECT * FROM disputes WHERE id=$1', [req.params.id]);
    if (!dRes.rows.length) return res.status(404).json({ error: 'Dispute not found' });

    await pool.query(
      `UPDATE disputes SET status='resolved', assigned_to=$1, resolution=$2,
         resolved_at=NOW() WHERE id=$3`,
      [req.user.id, resolution, req.params.id]
    );

    // Take financial action if needed
    const d = dRes.rows[0];
    if (refund_user && d.user_id) {
      // Trigger refund (Razorpay refund call)
      await pool.query(`UPDATE bookings SET payment_status='refunded' WHERE id=$1`, [d.booking_id]);
    }
    if (penalise_porter && d.porter_id) {
      const bRes = await pool.query('SELECT platform_fee FROM bookings WHERE id=$1', [d.booking_id]);
      const penalty = bRes.rows[0]?.platform_fee || 0;
      const walletSvc = require('../services/walletService');
      await walletSvc.debit(d.porter_id, penalty, d.booking_id, `Dispute penalty — ${d.booking_id}`).catch(()=>{});
    }

    await pool.query(`UPDATE bookings SET status='completed' WHERE id=$1`, [d.booking_id]);

    res.json({ message: 'Dispute resolved', disputeId: req.params.id, resolution });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Viewer: get disputes assigned to them
exports.getMyDisputeAssignments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
              b.arrival_station, b.total_amount, b.train_no,
              u.name as user_name, p.name as porter_name,
              EXTRACT(EPOCH FROM (d.sla_deadline - NOW()))/60 as minutes_remaining
       FROM disputes d
       JOIN bookings b ON d.booking_id = b.id
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN porters p ON d.porter_id = p.id
       WHERE d.assigned_to=$1 AND d.status='open'
       ORDER BY d.sla_deadline ASC`,
      [req.user.id]
    );
    res.json({ myDisputes: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ════════════════════════════════════════════════════════════
// MULTI-LANGUAGE
// ════════════════════════════════════════════════════════════

// Get all UI strings for a language (called by Android app on startup)
exports.getAppStrings = async (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const strings = await i18nService.getStrings(lang);
    res.json({ lang, strings });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Admin: add/update a string
exports.upsertString = async (req, res) => {
  try {
    const { key, lang, value } = req.body;
    await pool.query(
      `INSERT INTO app_strings (key, lang, value) VALUES ($1,$2,$3)
       ON CONFLICT (key, lang) DO UPDATE SET value=$3`,
      [key, lang, value]
    );
    res.json({ message: 'String updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Update porter preferred language
exports.updatePorterLanguage = async (req, res) => {
  try {
    const { lang } = req.body;
    if (!['en', 'hi'].includes(lang))
      return res.status(400).json({ error: 'Supported languages: en, hi' });
    await pool.query(
      'UPDATE porters SET preferred_lang=$1 WHERE id=$2',
      [lang, req.user.id]
    );
    res.json({ message: `Language set to ${lang === 'hi' ? 'Hindi' : 'English'}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Update user preferred language
exports.updateUserLanguage = async (req, res) => {
  try {
    const { lang } = req.body;
    await pool.query('UPDATE users SET preferred_lang=$1 WHERE id=$2', [lang, req.user.id]);
    res.json({ message: 'Language preference updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

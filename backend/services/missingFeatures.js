// ═══════════════════════════════════════════════════════════
//  services/missingFeatures.js
//  Implements: Trolley, Group Booking, Pre-scheduled,
//  Earnings Analytics, SOS, Dispute SLA, Multi-language
// ═══════════════════════════════════════════════════════════

const { pool }  = require('../config/db');
const notif     = require('./notificationService');

// ════════════════════════════════════════════════════════════
// 1. TROLLEY SERVICE
// ════════════════════════════════════════════════════════════
const trolleyService = {

  // Check if station has trolley + get available trolley porters
  async getStationTrolleyInfo(stationName) {
    const result = await pool.query(
      `SELECT s.has_trolley_service,
              COUNT(p.id) FILTER (WHERE p.has_trolley AND p.is_online AND p.status='approved') as trolley_porters
       FROM stations s
       LEFT JOIN porters p ON p.station = s.name
       WHERE s.name ILIKE $1
       GROUP BY s.has_trolley_service`,
      [stationName]
    );
    return result.rows[0] || { has_trolley_service: false, trolley_porters: 0 };
  },

  // Porter offers trolley to user (after accepting booking)
  async offerTrolley(bookingId, porterId, trolleyCharge) {
    const bRes = await pool.query('SELECT * FROM bookings WHERE id=$1 AND porter_id=$2', [bookingId, porterId]);
    if (!bRes.rows.length) throw new Error('Booking not found or not your booking');
    if (!['accepted','in_progress'].includes(bRes.rows[0].status))
      throw new Error('Can only offer trolley on active bookings');

    await pool.query(
      `UPDATE bookings SET needs_trolley=TRUE, trolley_charge=$1,
         total_amount=total_amount+$1, porter_amount=porter_amount+$1,
         updated_at=NOW() WHERE id=$2`,
      [trolleyCharge, bookingId]
    );

    return { offered: true, trolleyCharge, message: 'Trolley offer sent to user' };
  },

  // User accepts/declines trolley offer
  async respondToTrolley(bookingId, userId, accepted) {
    if (!accepted) {
      await pool.query(
        `UPDATE bookings SET needs_trolley=FALSE, trolley_charge=0,
           total_amount=total_amount-trolley_charge, porter_amount=porter_amount-trolley_charge
         WHERE id=$1 AND user_id=$2`,
        [bookingId, userId]
      );
      return { accepted: false };
    }
    return { accepted: true, message: 'Trolley service confirmed' };
  },
};

// ════════════════════════════════════════════════════════════
// 2. GROUP BOOKING SERVICE (2 porters simultaneously)
// ════════════════════════════════════════════════════════════
const groupBookingService = {

  // Create a group booking that notifies 2 porters simultaneously
  async createGroupBooking(bookingId, io) {
    const bRes = await pool.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
    const booking = bRes.rows[0];
    if (!booking) throw new Error('Booking not found');

    // Mark as group booking
    await pool.query(
      'UPDATE bookings SET is_group_booking=TRUE WHERE id=$1', [bookingId]
    );

    // Get 2 best eligible porters at station
    const assignSvc = require('./bookingAssignmentService');
    const porters = await assignSvc.getEligiblePorters(booking);

    if (porters.length < 2) {
      // Not enough porters — fall back to single porter
      await pool.query('UPDATE bookings SET is_group_booking=FALSE WHERE id=$1', [bookingId]);
      return { groupBooking: false, reason: 'Not enough porters available. Assigned single porter.' };
    }

    const porter1 = porters[0];
    const porter2 = porters[1];
    const halvedAmount = Math.floor(booking.porter_amount / 2);
    const expiresAt = new Date(Date.now() + 30 * 1000);

    // Insert both into group_booking_porters
    await pool.query(
      `INSERT INTO group_booking_porters (booking_id, porter_id, porter_number, status, porter_amount)
       VALUES ($1,$2,1,'pending',$4), ($1,$3,2,'pending',$4)`,
      [bookingId, porter1.id, porter2.id, halvedAmount]
    );

    // Notify BOTH simultaneously
    [porter1, porter2].forEach(async (p, idx) => {
      if (io) {
        io.to(`porter_${p.id}`).emit('new_booking_request', {
          bookingId,
          isGroupBooking: true,
          porterNumber: idx + 1,
          expiresIn: 30,
          fare: halvedAmount,
          bags: booking.bag_count,
          bagWeight: booking.bag_weight,
          station: booking.arrival_station,
          trainNo: booking.train_no,
          coach: booking.coach,
          message: `GROUP BOOKING — You will handle half the luggage. ₹${halvedAmount} for you.`,
        });
      }
      await notif.sendPushToPorter(p.fcm_token, {
        title: '🚨 Group Booking!',
        body: `${booking.bag_count} bags (split). ₹${halvedAmount} for you. 30 sec!`,
        data: { bookingId, isGroupBooking: 'true' }
      });
    });

    // Handle 30-sec expiry for group booking
    setTimeout(() => groupBookingService.handleGroupExpiry(bookingId, io), 30000);

    return { groupBooking: true, porter1: porter1.name, porter2: porter2.name };
  },

  // Porter responds to group booking
  async respondGroupBooking(bookingId, porterId, accepted) {
    await pool.query(
      `UPDATE group_booking_porters SET status=$1, accepted_at=$2
       WHERE booking_id=$3 AND porter_id=$4`,
      [accepted ? 'accepted' : 'rejected', accepted ? new Date() : null, bookingId, porterId]
    );

    // Check if both accepted
    const result = await pool.query(
      `SELECT * FROM group_booking_porters WHERE booking_id=$1`, [bookingId]
    );
    const both = result.rows;
    const bothAccepted = both.every(r => r.status === 'accepted');
    const anyRejected  = both.some(r => r.status === 'rejected');

    if (bothAccepted) {
      // Assign both porters to booking
      await pool.query(
        `UPDATE bookings SET porter_id=$1, second_porter_id=$2, status='accepted', accepted_at=NOW()
         WHERE id=$3`,
        [both[0].porter_id, both[1].porter_id, bookingId]
      );
      return { status: 'both_accepted' };
    }
    if (anyRejected) {
      // Fall back — find replacement
      return { status: 'need_replacement' };
    }
    return { status: 'waiting' };
  },

  async handleGroupExpiry(bookingId, io) {
    const result = await pool.query(
      `SELECT * FROM group_booking_porters WHERE booking_id=$1 AND status='pending'`, [bookingId]
    );
    if (result.rows.length > 0) {
      // Still pending — convert to single porter booking
      await pool.query(
        `UPDATE bookings SET is_group_booking=FALSE WHERE id=$1`, [bookingId]
      );
      const assignSvc = require('./bookingAssignmentService');
      await assignSvc.notifyNextPorter(bookingId, io);
    }
  },
};

// ════════════════════════════════════════════════════════════
// 3. PRE-SCHEDULED BOOKING SERVICE
// ════════════════════════════════════════════════════════════
const scheduledBookingService = {

  // Schedule a booking for future dispatch (max 2 hours before arrival)
  async scheduleBooking(bookingId, scheduledFor) {
    const MAX_ADVANCE_HOURS = 2;
    const scheduledTime = new Date(scheduledFor);
    const now = new Date();
    const hoursAhead = (scheduledTime - now) / 3600000;

    if (hoursAhead > MAX_ADVANCE_HOURS)
      throw new Error(`Can only pre-book up to ${MAX_ADVANCE_HOURS} hours in advance`);
    if (scheduledTime <= now)
      throw new Error('Scheduled time must be in the future');

    await pool.query(
      `UPDATE bookings SET
         is_scheduled=TRUE,
         scheduled_for=$1,
         schedule_status='scheduled',
         status='pending',
         updated_at=NOW()
       WHERE id=$2`,
      [scheduledFor, bookingId]
    );

    return {
      scheduled: true,
      scheduledFor,
      message: `Booking scheduled. Porter notification will start at ${scheduledTime.toLocaleTimeString('en-IN')}`,
    };
  },

  // Called by cron every minute — dispatch scheduled bookings
  async dispatchScheduledBookings(io) {
    const result = await pool.query(
      `SELECT * FROM bookings
       WHERE is_scheduled=TRUE
         AND schedule_status='scheduled'
         AND scheduled_for <= NOW()
         AND status='pending'`
    );

    for (const booking of result.rows) {
      await pool.query(
        `UPDATE bookings SET schedule_status='dispatched' WHERE id=$1`, [booking.id]
      );
      const assignSvc = require('./bookingAssignmentService');
      await assignSvc.notifyNextPorter(booking.id, io);
      console.log(`📅 Dispatched scheduled booking: ${booking.id}`);
    }
  },
};

// ════════════════════════════════════════════════════════════
// 4. PORTER EARNINGS ANALYTICS
// ════════════════════════════════════════════════════════════
const earningsAnalytics = {

  async getDetailedEarnings(porterId) {
    const [today, week, month, allTime, daily, bestDay, bestMonth] = await Promise.all([
      // Today
      pool.query(
        `SELECT COALESCE(SUM(amount),0) as earnings, COUNT(*) as bookings
         FROM wallet_transactions WHERE porter_id=$1 AND type='credit' AND DATE(created_at)=CURRENT_DATE`,
        [porterId]
      ),
      // This week
      pool.query(
        `SELECT COALESCE(SUM(amount),0) as earnings, COUNT(*) as bookings
         FROM wallet_transactions WHERE porter_id=$1 AND type='credit'
           AND created_at >= DATE_TRUNC('week', NOW())`,
        [porterId]
      ),
      // This month
      pool.query(
        `SELECT COALESCE(SUM(amount),0) as earnings, COUNT(*) as bookings
         FROM wallet_transactions WHERE porter_id=$1 AND type='credit'
           AND created_at >= DATE_TRUNC('month', NOW())`,
        [porterId]
      ),
      // All time
      pool.query(
        `SELECT COALESCE(SUM(amount),0) as earnings, COUNT(*) as bookings
         FROM wallet_transactions WHERE porter_id=$1 AND type='credit'`,
        [porterId]
      ),
      // Last 30 days daily breakdown
      pool.query(
        `SELECT date, earnings, bookings
         FROM porter_daily_earnings
         WHERE porter_id=$1 AND date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY date DESC`,
        [porterId]
      ),
      // Best performing day ever
      pool.query(
        `SELECT date, earnings, bookings
         FROM porter_daily_earnings
         WHERE porter_id=$1
         ORDER BY earnings DESC LIMIT 1`,
        [porterId]
      ),
      // Best month
      pool.query(
        `SELECT DATE_TRUNC('month', date) as month,
                SUM(earnings) as total_earnings,
                SUM(bookings) as total_bookings
         FROM porter_daily_earnings WHERE porter_id=$1
         GROUP BY DATE_TRUNC('month', date)
         ORDER BY total_earnings DESC LIMIT 1`,
        [porterId]
      ),
    ]);

    // Weekly breakdown (last 7 days)
    const weeklyBreakdown = await pool.query(
      `SELECT DATE(created_at) as day,
              TO_CHAR(DATE(created_at), 'Dy') as day_name,
              COALESCE(SUM(amount),0) as earnings,
              COUNT(*) as bookings
       FROM wallet_transactions
       WHERE porter_id=$1 AND type='credit'
         AND created_at >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY DATE(created_at), TO_CHAR(DATE(created_at), 'Dy')
       ORDER BY DATE(created_at) ASC`,
      [porterId]
    );

    return {
      summary: {
        today:   { earnings: parseFloat(today.rows[0].earnings),   bookings: parseInt(today.rows[0].bookings) },
        week:    { earnings: parseFloat(week.rows[0].earnings),     bookings: parseInt(week.rows[0].bookings) },
        month:   { earnings: parseFloat(month.rows[0].earnings),    bookings: parseInt(month.rows[0].bookings) },
        allTime: { earnings: parseFloat(allTime.rows[0].earnings),  bookings: parseInt(allTime.rows[0].bookings) },
      },
      bestDay:   bestDay.rows[0]   || null,
      bestMonth: bestMonth.rows[0] || null,
      last30Days:      daily.rows,
      last7DaysChart:  weeklyBreakdown.rows,
    };
  },
};

// ════════════════════════════════════════════════════════════
// 5. SOS SERVICE — Full implementation
// ════════════════════════════════════════════════════════════
const sosService = {

  async raiseSOS({ raisedBy, userId, porterId, bookingId, latitude, longitude }) {
    const client = await pool.connect();
    try {
      // Insert SOS alert
      const sosRes = await client.query(
        `INSERT INTO sos_alerts
           (raised_by, user_id, porter_id, booking_id, location, latitude, longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [raisedBy, userId||null, porterId||null, bookingId||null,
         latitude && longitude ? `${latitude},${longitude}` : null,
         latitude||null, longitude||null]
      );
      const sos = sosRes.rows[0];

      // Get emergency contact
      let emergencyPhone = null;
      let personName = null;
      if (raisedBy === 'porter' && porterId) {
        const pRes = await client.query(
          'SELECT name, emergency_contact FROM porters WHERE id=$1', [porterId]
        );
        emergencyPhone = pRes.rows[0]?.emergency_contact;
        personName     = pRes.rows[0]?.name;
      } else if (raisedBy === 'user' && userId) {
        const uRes = await client.query(
          'SELECT name, whatsapp_no FROM users WHERE id=$1', [userId]
        );
        personName = uRes.rows[0]?.name;
        // Users can add emergency contact in future
      }

      // Notify emergency contact via SMS
      if (emergencyPhone) {
        const mapsLink = latitude ? `https://maps.google.com/?q=${latitude},${longitude}` : 'Location unavailable';
        await notif.sendSMS(emergencyPhone,
          `🆘 EMERGENCY from HelloCoolie: ${personName} has raised an SOS at railway station. Location: ${mapsLink}. Please help immediately.`
        );
        await client.query(
          'UPDATE sos_alerts SET emergency_contact=$1, emergency_notified=TRUE WHERE id=$2',
          [emergencyPhone, sos.id]
        );
      }

      // Notify all admins via Socket.IO
      // (io not available in service — controller passes it)
      await client.query(
        'UPDATE sos_alerts SET admin_notified=TRUE WHERE id=$1', [sos.id]
      );

      return { sosId: sos.id, emergencyNotified: !!emergencyPhone };
    } finally {
      client.release();
    }
  },

  // Admin/Viewer resolves SOS
  async resolveSOS(sosId, resolvedById) {
    await pool.query(
      `UPDATE sos_alerts SET status='resolved', resolved_by=$1, resolved_at=NOW() WHERE id=$2`,
      [resolvedById, sosId]
    );
    return { resolved: true };
  },
};

// ════════════════════════════════════════════════════════════
// 6. DISPUTE SLA SERVICE
// ════════════════════════════════════════════════════════════
const disputeService = {

  async createDispute({ bookingId, raisedBy, userId, porterId, description }) {
    const slaDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    const result = await pool.query(
      `INSERT INTO disputes
         (booking_id, raised_by, user_id, porter_id, description, sla_deadline)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [bookingId, raisedBy, userId, porterId, description, slaDeadline]
    );

    await pool.query(
      `UPDATE bookings SET status='disputed', updated_at=NOW() WHERE id=$1`, [bookingId]
    );

    // Auto-assign to an available viewer
    const viewerRes = await pool.query(
      `SELECT id FROM viewers WHERE is_active=TRUE
       ORDER BY (
         SELECT COUNT(*) FROM disputes WHERE assigned_to = viewers.id AND status='open'
       ) ASC LIMIT 1`
    );

    if (viewerRes.rows.length) {
      const viewerId = viewerRes.rows[0].id;
      await pool.query(
        `UPDATE disputes SET assigned_to=$1, auto_assigned_at=NOW() WHERE id=$2`,
        [viewerId, result.rows[0].id]
      );
    }

    return {
      disputeId: result.rows[0].id,
      slaDeadline,
      message: 'Dispute raised. A viewer has been assigned and will investigate within 2 hours.',
    };
  },

  // Cron: check SLA breaches every 15 minutes
  async checkSLABreaches(io) {
    const breached = await pool.query(
      `UPDATE disputes SET sla_breached=TRUE
       WHERE status='open' AND sla_deadline < NOW() AND sla_breached=FALSE
       RETURNING id, booking_id, assigned_to`
    );

    for (const d of breached.rows) {
      // Alert admin about SLA breach
      if (io) {
        io.to('admin_room').emit('dispute_sla_breached', {
          disputeId: d.id,
          bookingId: d.booking_id,
          message: '⚠️ Dispute SLA breached — 2 hours exceeded without resolution!',
        });
      }
    }
  },
};

// ════════════════════════════════════════════════════════════
// 7. MULTI-LANGUAGE SERVICE
// ════════════════════════════════════════════════════════════
const i18nService = {

  // Get all strings for a language
  async getStrings(lang = 'en') {
    const result = await pool.query(
      'SELECT key, value FROM app_strings WHERE lang=$1', [lang]
    );
    return result.rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
  },

  // Get a specific string
  async getString(key, lang = 'en') {
    const result = await pool.query(
      'SELECT value FROM app_strings WHERE key=$1 AND lang=$2', [key, lang]
    );
    return result.rows[0]?.value || key;
  },

  // Format notification in porter's preferred language
  async formatForPorter(porterId, templateKey, variables = {}) {
    const pRes = await pool.query('SELECT preferred_lang FROM porters WHERE id=$1', [porterId]).catch(() => ({ rows: [] }));
    const lang = pRes.rows[0]?.preferred_lang || 'hi'; // Default Hindi for porters
    let template = await this.getString(templateKey, lang);
    // Simple variable replacement
    Object.entries(variables).forEach(([k, v]) => {
      template = template.replace(new RegExp(`{${k}}`, 'g'), v);
    });
    return template;
  },
};

module.exports = {
  trolleyService,
  groupBookingService,
  scheduledBookingService,
  earningsAnalytics,
  sosService,
  disputeService,
  i18nService,
};

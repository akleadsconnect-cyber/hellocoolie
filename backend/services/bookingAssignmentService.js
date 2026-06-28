const { pool } = require('../config/db');
const notificationService = require('./notificationService');

const NOTIFY_SECONDS = parseInt(process.env.PORTER_NOTIFY_SECONDS || 30);

// ── Priority score for porter selection ──────────────────────
// Factors: bag count, bag weight, seniority (experience), rating
// booking parameter added so we can check is_senior + is_woman_solo
const getPorterPriorityScore = (porter, bagCount, bagWeight, booking = {}) => {
  let score = 0;

  // 1. Bag weight capability
  const weightLevels = { normal: 1, medium: 2, heavy: 3, very_heavy: 4 };
  const bagLevel = weightLevels[bagWeight] || 1;
  if (bagLevel >= 4 && !porter.can_carry_very_heavy) return -1; // cannot carry

  // 2. For 2–3 bags: prefer older/experienced porters
  if (bagCount >= 2 && bagCount <= 3) {
    score += porter.experience_years * 2;  // up to +20 points
    score += porter.total_bookings * 0.1;  // experience bonus
  }

  // 3. Rating bonus
  score += (parseFloat(porter.rating) || 0) * 5; // up to +25

  // 4. Senior citizen / woman travelling alone → highest rated porter
  //    Give a massive boost to high-rated porters for these cases
  if (booking.is_senior || booking.is_woman_solo) {
    score += (parseFloat(porter.rating) || 0) * 10; // double rating weight
    score += porter.experience_years * 3;            // extra experience weight
    // Female porter gets extra priority for woman travelling alone
    if (booking.is_woman_solo && porter.gender === 'female') {
      score += 50; // strong preference for female porter
    }
  }

  // 5. Lower current load preferred
  score += porter.is_on_job ? -10 : 0;

  // 6. Trolley-capable porter for trolley bookings
  if (booking.needs_trolley && porter.has_trolley) {
    score += 30;
  }

  return score;
};

// ── Get eligible porters at station (round robin) ────────────
const getEligiblePorters = async (booking) => {
  const { arrival_station, bag_count, bag_weight, notified_porter_ids = [] } = booking;

  const result = await pool.query(
    `SELECT p.*, 
            (p.total_cancellations::float / NULLIF(p.total_bookings, 0)) AS cancel_rate
     FROM porters p
     WHERE p.station = $1
       AND p.is_online = TRUE
       AND p.is_on_job = FALSE
       AND p.status = 'approved'
       AND p.is_active = TRUE
       AND p.id != ALL($2::uuid[])
     ORDER BY p.total_bookings ASC, p.rating DESC`,
    [arrival_station, notified_porter_ids.length ? notified_porter_ids : [null]]
  );

  // Apply priority scoring
  const scored = result.rows
    .map(p => ({ ...p, priorityScore: getPorterPriorityScore(p, bag_count, bag_weight, booking) }))
    .filter(p => p.priorityScore >= 0)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return scored;
};

// ── Notify next porter in queue ──────────────────────────────
const notifyNextPorter = async (bookingId, io) => {
  const bookingRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const booking = bookingRes.rows[0];
  if (!booking || !['pending'].includes(booking.status)) return;

  const eligible = await getEligiblePorters(booking);

  if (!eligible.length) {
    // No porter available — expire booking
    await pool.query(
      `UPDATE bookings SET status = 'expired', expired_at = NOW() WHERE id = $1`,
      [bookingId]
    );
    // Notify user
    if (io) io.to(`user_${booking.user_id}`).emit('booking_expired', { bookingId });
    return;
  }

  const porter = eligible[0];
  const expiresAt = new Date(Date.now() + NOTIFY_SECONDS * 1000);

  // Record notification
  await pool.query(
    `INSERT INTO booking_notifications (booking_id, porter_id, expires_at)
     VALUES ($1, $2, $3)`,
    [bookingId, porter.id, expiresAt]
  );

  // Update booking with current notified porter
  await pool.query(
    `UPDATE bookings SET
       current_notify_porter = $1,
       notify_expires_at = $2,
       notified_porter_ids = array_append(notified_porter_ids, $1)
     WHERE id = $3`,
    [porter.id, expiresAt, bookingId]
  );

  // Send notification to porter
  if (io) {
    io.to(`porter_${porter.id}`).emit('new_booking_request', {
      bookingId,
      expiresIn: NOTIFY_SECONDS,
      fare: booking.porter_amount,
      totalFare: booking.total_amount,
      platformFee: booking.platform_fee,
      bags: booking.bag_count,
      bagWeight: booking.bag_weight,
      dropLocation: booking.drop_location,
      station: booking.arrival_station,
      trainNo: booking.train_no,
      coach: booking.coach,
      seatNo: booking.seat_no,
      arrivalTime: booking.arrival_time,
      traveller: {
        name: booking.traveller_name,
        isSenior: booking.is_senior,
        isWomanSolo: booking.is_woman_solo,
        age: booking.traveller_age,
        gender: booking.traveller_gender,
      }
      // Note: traveller phone NOT revealed here — only after OTP
    });
  }

  // Push notification (FCM) as backup
  await notificationService.sendPushToPorter(porter.fcm_token, {
    title: '🚨 New Booking Request!',
    body: `${booking.bag_count} bag(s) at ${booking.arrival_station}. ₹${booking.porter_amount} for you. Accept in 30 sec!`,
    data: { bookingId, type: 'new_request' }
  });

  // Schedule expiry check after 30 seconds
  setTimeout(async () => {
    await handlePorterExpiry(bookingId, porter.id, io);
  }, NOTIFY_SECONDS * 1000);
};

// ── Handle porter timeout (30 sec expired) ───────────────────
const handlePorterExpiry = async (bookingId, porterId, io) => {
  // Check if still pending (not accepted by this or another porter)
  const bookingRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const booking = bookingRes.rows[0];
  if (!booking || booking.status !== 'pending') return;
  if (booking.current_notify_porter?.toString() !== porterId.toString()) return;

  // Mark notification expired
  await pool.query(
    `UPDATE booking_notifications SET response = 'expired', responded_at = NOW()
     WHERE booking_id = $1 AND porter_id = $2 AND response IS NULL`,
    [bookingId, porterId]
  );

  // Notify next porter
  await notifyNextPorter(bookingId, io);
};

// ── Porter accepts booking ───────────────────────────────────
const acceptBooking = async (bookingId, porterId, io) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bRes = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    const booking = bRes.rows[0];

    if (!booking || booking.status !== 'pending')
      throw new Error('Booking no longer available');
    if (booking.current_notify_porter?.toString() !== porterId.toString())
      throw new Error('This booking was not sent to you');

    const pRes = await client.query('SELECT * FROM porters WHERE id = $1', [porterId]);
    const porter = pRes.rows[0];

    // Generate OTP for job start
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await client.query(
      `UPDATE bookings SET
         status = 'accepted',
         porter_id = $1,
         porter_name = $2,
         otp_code = $3,
         accepted_at = NOW(),
         updated_at = NOW()
       WHERE id = $4`,
      [porterId, porter.name, otp, bookingId]
    );

    // Mark porter as busy
    await client.query('UPDATE porters SET is_on_job = TRUE WHERE id = $1', [porterId]);

    // Mark notification accepted
    await client.query(
      `UPDATE booking_notifications SET response = 'accepted', responded_at = NOW()
       WHERE booking_id = $1 AND porter_id = $2`,
      [bookingId, porterId]
    );

    await client.query('COMMIT');

    // Notify user — porter found! (contact revealed after OTP)
    if (io) {
      io.to(`user_${booking.user_id}`).emit('porter_assigned', {
        bookingId,
        porter: {
          name: porter.name,
          rating: porter.rating,
          totalBookings: porter.total_bookings,
          badgeNo: porter.badge_no,
          // phone NOT revealed yet — only after OTP
        },
        otp,  // shown to user to give to porter
        message: 'Your porter is on the way! Show OTP to porter when they arrive.'
      });

      // Notify porter — traveller details (no phone yet)
      io.to(`porter_${porterId}`).emit('booking_confirmed', {
        bookingId,
        traveller: {
          name: booking.traveller_name,
          coach: booking.coach,
          seatNo: booking.seat_no,
          bags: booking.bag_count,
          bagWeight: booking.bag_weight,
          isSenior: booking.is_senior,
          // phone revealed after OTP confirmation
        },
        fare: booking.porter_amount,
        message: 'Booking confirmed! Go to coach and ask user for OTP.'
      });
    }

    return { success: true, otp };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Porter rejects booking ───────────────────────────────────
const rejectBooking = async (bookingId, porterId, io) => {
  await pool.query(
    `UPDATE booking_notifications SET response = 'rejected', responded_at = NOW()
     WHERE booking_id = $1 AND porter_id = $2`,
    [bookingId, porterId]
  );
  // Move to next porter
  await notifyNextPorter(bookingId, io);
};

// ── OTP verification — job start ─────────────────────────────
const verifyJobOTP = async (bookingId, porterId, enteredOTP, io) => {
  const bRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const booking = bRes.rows[0];

  if (!booking) throw new Error('Booking not found');
  if (booking.porter_id.toString() !== porterId.toString()) throw new Error('Not your booking');
  if (booking.status !== 'accepted') throw new Error('Booking not in accepted state');
  if (booking.otp_code !== enteredOTP) throw new Error('Incorrect OTP');

  // Start job
  await pool.query(
    `UPDATE bookings SET
       status = 'in_progress',
       otp_verified_at = NOW(),
       porter_phone = (SELECT phone FROM porters WHERE id = $1),
       updated_at = NOW()
     WHERE id = $2`,
    [porterId, bookingId]
  );

  // NOW reveal both contacts
  const porterRes = await pool.query('SELECT phone FROM porters WHERE id = $1', [porterId]);

  if (io) {
    // Reveal porter phone to user
    io.to(`user_${booking.user_id}`).emit('job_started', {
      bookingId,
      porterPhone: porterRes.rows[0].phone,
      message: 'Job started! Porter contact is now available.'
    });
    // Reveal user phone to porter
    io.to(`porter_${porterId}`).emit('job_started_porter', {
      bookingId,
      userPhone: booking.traveller_phone,
      userName: booking.traveller_name,
      message: 'OTP verified! You can now call the passenger if needed.'
    });
  }

  return { success: true };
};

module.exports = { notifyNextPorter, acceptBooking, rejectBooking, verifyJobOTP, getEligiblePorters };

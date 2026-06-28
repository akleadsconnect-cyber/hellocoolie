const { pool } = require('../config/db');
const walletService = require('./walletService');

const CANCEL_WINDOW_MINUTES = parseInt(process.env.CANCEL_WINDOW_MINUTES || 15);
const CANCEL_FEE_PCT = 15;
const FRAUD_CANCEL_THRESHOLD = parseInt(process.env.FRAUD_CANCEL_THRESHOLD || 3);

// ── Calculate minutes until train arrival ────────────────────
const minutesToArrival = (arrivalTime) => {
  if (!arrivalTime) return 999;
  return Math.floor((new Date(arrivalTime) - new Date()) / 60000);
};

// ── Cancel booking ───────────────────────────────────────────
const cancelBooking = async (bookingId, cancelledBy, reason, cancellerIdType) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bRes = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    const booking = bRes.rows[0];
    if (!booking) throw new Error('Booking not found');

    const allowedStatuses = ['pending', 'accepted', 'in_progress'];
    if (!allowedStatuses.includes(booking.status))
      throw new Error('Cannot cancel a completed or already cancelled booking');

    const minsLeft = minutesToArrival(booking.arrival_time);
    const feeApplicable = minsLeft <= CANCEL_WINDOW_MINUTES && booking.status !== 'pending';
    const cancelFee = feeApplicable ? Math.round(booking.total_amount * CANCEL_FEE_PCT / 100) : 0;

    const newStatus = cancelledBy === 'user' ? 'cancelled_by_user' : 'cancelled_by_porter';

    // Update booking
    await client.query(
      `UPDATE bookings SET
         status = $1,
         cancelled_by = $2,
         cancel_reason = $3,
         cancel_fee = $4,
         cancel_fee_charged = $5,
         updated_at = NOW()
       WHERE id = $6`,
      [newStatus, cancelledBy, reason, cancelFee, feeApplicable, bookingId]
    );

    // Log cancellation
    await client.query(
      `INSERT INTO cancellations
         (booking_id, cancelled_by, user_id, porter_id, reason, fee_applicable, fee_amount, minutes_to_arrival)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [bookingId, cancelledBy, booking.user_id, booking.porter_id,
       reason, feeApplicable, cancelFee, minsLeft]
    );

    // Charge cancellation fee
    if (feeApplicable) {
      if (cancelledBy === 'user' && booking.payment_method === 'online') {
        // Deduct from user refund (partial refund)
        // In real app: Razorpay partial refund of (amount - cancelFee)
      } else if (cancelledBy === 'porter' && booking.porter_id) {
        // Deduct from porter wallet
        await walletService.debit(
          booking.porter_id, cancelFee, bookingId,
          `Cancellation penalty — booking ${bookingId}`, client
        );
      }
    } else if (booking.payment_method === 'online' && booking.payment_status === 'paid') {
      // Full refund to user (Razorpay refund call in payment controller)
    }

    // Free up porter
    if (booking.porter_id) {
      await client.query(
        'UPDATE porters SET is_on_job = FALSE WHERE id = $1',
        [booking.porter_id]
      );
      // Increment porter cancellation count
      await client.query(
        'UPDATE porters SET total_cancellations = total_cancellations + 1 WHERE id = $1',
        [booking.porter_id]
      );

      // Check fraud threshold
      if (cancelledBy === 'porter') {
        await checkFraudPattern(booking.porter_id, bookingId, client);
      }
    }

    await client.query('COMMIT');
    return { success: true, feeApplicable, cancelFee, minsLeft };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Fraud detection — frequent cancellations ─────────────────
const checkFraudPattern = async (porterId, bookingId, client) => {
  // Count recent cancellations (last 7 days)
  const result = await client.query(
    `SELECT COUNT(*) as cnt FROM cancellations
     WHERE porter_id = $1 AND cancelled_by = 'porter'
       AND created_at > NOW() - INTERVAL '7 days'`,
    [porterId]
  );

  const cancelCount = parseInt(result.rows[0].cnt);
  if (cancelCount >= FRAUD_CANCEL_THRESHOLD) {
    // Auto-flag for fraud
    await client.query(
      `INSERT INTO fraud_flags (porter_id, flag_type, booking_id, description, auto_flagged)
       VALUES ($1, 'frequent_cancel', $2, $3, TRUE)
       ON CONFLICT DO NOTHING`,
      [porterId, bookingId,
       `Porter cancelled ${cancelCount} bookings in last 7 days. Possible direct dealing.`]
    );

    // Update porter fraud flag count
    await client.query(
      'UPDATE porters SET fraud_flag_count = fraud_flag_count + 1 WHERE id = $1',
      [porterId]
    );

    // Auto-suspend if very high
    if (cancelCount >= FRAUD_CANCEL_THRESHOLD * 2) {
      await client.query(
        `UPDATE porters SET status = 'suspended', suspend_reason = $1,
           suspended_at = NOW() WHERE id = $2`,
        [`Auto-suspended: ${cancelCount} cancellations in 7 days`, porterId]
      );
    }
  }
};

module.exports = { cancelBooking, minutesToArrival };

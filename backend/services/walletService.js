const { pool } = require('../config/db');

// ── Credit porter wallet ──────────────────────────────────────
const credit = async (porterId, amount, bookingId, description, client = null) => {
  const db = client || pool;
  const pRes = await db.query('SELECT wallet_balance FROM porters WHERE id = $1', [porterId]);
  const before = parseFloat(pRes.rows[0].wallet_balance);
  const after  = before + parseFloat(amount);

  await db.query('UPDATE porters SET wallet_balance = $1 WHERE id = $2', [after, porterId]);
  await db.query(
    `INSERT INTO wallet_transactions (porter_id, booking_id, type, amount, balance_before, balance_after, description)
     VALUES ($1, $2, 'credit', $3, $4, $5, $6)`,
    [porterId, bookingId, amount, before, after, description]
  );
  return { before, after, amount };
};

// ── Debit porter wallet ───────────────────────────────────────
const debit = async (porterId, amount, bookingId, description, client = null) => {
  const db = client || pool;
  const pRes = await db.query('SELECT wallet_balance FROM porters WHERE id = $1', [porterId]);
  const before = parseFloat(pRes.rows[0].wallet_balance);
  if (before < amount) throw new Error('Insufficient wallet balance');
  const after = before - parseFloat(amount);

  await db.query('UPDATE porters SET wallet_balance = $1 WHERE id = $2', [after, porterId]);
  await db.query(
    `INSERT INTO wallet_transactions (porter_id, booking_id, type, amount, balance_before, balance_after, description)
     VALUES ($1, $2, 'debit', $3, $4, $5, $6)`,
    [porterId, bookingId, amount, before, after, description]
  );
  return { before, after, amount };
};

// ── Instant withdrawal ────────────────────────────────────────
const withdraw = async (porterId, amount, upiId) => {
  const MIN = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || 100);
  if (amount < MIN) throw new Error(`Minimum withdrawal amount is ₹${MIN}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pRes = await client.query(
      'SELECT wallet_balance, upi_id FROM porters WHERE id = $1 FOR UPDATE', [porterId]
    );
    const porter = pRes.rows[0];
    if (parseFloat(porter.wallet_balance) < amount)
      throw new Error('Insufficient wallet balance');

    const upi = upiId || porter.upi_id;
    if (!upi) throw new Error('No UPI ID found. Please add UPI ID in profile.');

    // Create withdrawal record
    const wRes = await client.query(
      `INSERT INTO withdrawals (porter_id, amount, upi_id, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [porterId, amount, upi]
    );

    // Debit wallet
    await debit(porterId, amount, null, `Withdrawal to UPI: ${upi}`, client);

    // TODO: In production — call Razorpay Payout API here
    // For now, mark as processed (manual)
    await client.query(
      `UPDATE withdrawals SET status = 'processed', processed_at = NOW() WHERE id = $1`,
      [wRes.rows[0].id]
    );

    await client.query('COMMIT');
    return { success: true, withdrawalId: wRes.rows[0].id, amount, upi };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Get porter wallet summary ─────────────────────────────────
const getWalletSummary = async (porterId) => {
  const [balRes, txRes] = await Promise.all([
    pool.query('SELECT wallet_balance FROM porters WHERE id = $1', [porterId]),
    pool.query(
      `SELECT * FROM wallet_transactions WHERE porter_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [porterId]
    ),
  ]);
  return {
    balance: parseFloat(balRes.rows[0].wallet_balance),
    transactions: txRes.rows,
  };
};

// ── Recover offline platform fee ──────────────────────────────
const recoverOfflineFee = async (bookingId) => {
  const bRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const booking = bRes.rows[0];
  if (!booking) throw new Error('Booking not found');
  if (booking.payment_method !== 'cash') throw new Error('Not a cash booking');
  if (booking.offline_fee_recovered) throw new Error('Fee already recovered');

  await debit(
    booking.porter_id, booking.platform_fee, bookingId,
    `Offline platform fee recovery — booking ${bookingId}`
  );
  await pool.query(
    'UPDATE bookings SET offline_fee_recovered = TRUE WHERE id = $1', [bookingId]
  );
  return { success: true, recovered: booking.platform_fee };
};

module.exports = { credit, debit, withdraw, getWalletSummary, recoverOfflineFee };

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const cron       = require('node-cron');
const { initDB } = require('./config/db');
const { pool }   = require('./config/db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Slow down.' }
}));

// Make io accessible in controllers
app.set('io', io);

// ── Routes ─────────────────────────────────────────────────
app.use('/api', require('./routes/index'));

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ════════════════════════════════════════════════════════════
// SOCKET.IO — Real-time events
// ════════════════════════════════════════════════════════════
const jwt = require('jsonwebtoken');

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  const { id, role } = socket.user;
  console.log(`🔌 ${role} connected: ${id}`);

  // Join personal room
  socket.join(`${role}_${id}`);

  // Porter joins station room (for broadcasts)
  if (role === 'porter') {
    socket.on('join_station', (station) => socket.join(`station_${station}`));
  }

  // Admin/Viewer joins admin room
  if (role === 'admin' || role === 'viewer') {
    socket.join('admin_room');
  }

  socket.on('disconnect', async () => {
    if (role === 'porter') {
      // Auto-mark offline when socket disconnects
      await pool.query('UPDATE porters SET is_online=FALSE WHERE id=$1', [id])
        .catch(console.error);
    }
    console.log(`🔌 ${role} disconnected: ${id}`);
  });
});

// ════════════════════════════════════════════════════════════
// CRON JOBS
// ════════════════════════════════════════════════════════════

// Auto-expire bookings with no porter (run every 2 minutes)
cron.schedule('*/2 * * * *', async () => {
  try {
    const expired = await pool.query(
      `UPDATE bookings SET status='expired', expired_at=NOW()
       WHERE status='pending'
         AND created_at < NOW() - INTERVAL '10 minutes'
       RETURNING id, user_id`
    );
    for (const b of expired.rows) {
      io.to(`user_${b.user_id}`).emit('booking_expired', {
        bookingId: b.id,
        message: 'No porter found near your station. Full refund initiated.'
      });
    }
  } catch (err) { console.error('Cron expire error:', err.message); }
});

// Auto-reactivate temp-suspended porters after 48 hours
cron.schedule('0 * * * *', async () => {
  try {
    await pool.query(
      `UPDATE porters SET status='approved'
       WHERE status='suspended'
         AND suspend_reason LIKE '%Temp suspend (48hr)%'
         AND suspended_at < NOW() - INTERVAL '48 hours'`
    );
  } catch (err) { console.error('Cron reactivate error:', err.message); }
});

// Offline fee recovery attempts — daily at 6 AM
cron.schedule('0 6 * * *', async () => {
  try {
    const pending = await pool.query(
      `SELECT b.id, b.porter_id, b.platform_fee
       FROM bookings b
       WHERE b.payment_method='cash' AND b.status='completed'
         AND b.offline_fee_recovered=FALSE
         AND b.completed_at < NOW() - INTERVAL '1 hour'`
    );
    for (const b of pending.rows) {
      try {
        const walletService = require('./services/walletService');
        await walletService.recoverOfflineFee(b.id);
        console.log(`✅ Offline fee recovered: ${b.id}`);
      } catch {
        // Wallet insufficient — flag for manual recovery
      }
    }
  } catch (err) { console.error('Cron offline fee error:', err.message); }
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 HelloCoolie API v2.0 running on port ${PORT}`);
    console.log(`💬 "Your Porter, Just a Hello Away!"`);
    console.log(`🔌 Socket.IO ready for real-time notifications`);
  });
}).catch(err => {
  console.error('❌ Startup failed:', err.message);
  process.exit(1);
});

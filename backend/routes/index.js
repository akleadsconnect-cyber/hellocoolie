// ═══════════════════════════════════════════════════════════
//  routes/index.js — ALL API routes centralized
//  HelloCoolie v2.1 — "Your Porter, Just a Hello Away!"
// ═══════════════════════════════════════════════════════════
const router  = require('express').Router();
const { authenticate, authorize, appOnly } = require('../middleware/auth');

// Controllers
const auth     = require('../controllers/authController');
const booking  = require('../controllers/bookingController');
const admin    = require('../controllers/adminController');
const ctrl     = require('../controllers/allControllers');
const features = require('../controllers/featuresController');

// ════════════════════════════════════════════════════════════
// AUTH — /api/auth
// ════════════════════════════════════════════════════════════
const authRouter = require('express').Router();
authRouter.post('/user/register',    auth.userRegister);
authRouter.post('/user/login',       auth.userLogin);
authRouter.post('/porter/register',  auth.porterRegister);
authRouter.post('/porter/login',     auth.porterLogin);
authRouter.post('/admin/login',      auth.adminLogin);
authRouter.post('/viewer/login',     auth.viewerLogin);
authRouter.post('/send-otp',         auth.sendOTP);
authRouter.post('/verify-otp',       auth.verifyOTP);
authRouter.post('/reset-password',   auth.resetPassword);
authRouter.patch('/fcm-token',       authenticate, auth.updateFCMToken);
router.use('/auth', authRouter);

// ════════════════════════════════════════════════════════════
// USER — /api/user  (App only)
// ════════════════════════════════════════════════════════════
const userRouter = require('express').Router();
userRouter.use(authenticate, authorize('user'), appOnly);
userRouter.get('/profile',                    ctrl.getUserProfile);
userRouter.patch('/profile',                  ctrl.updateUserProfile);
userRouter.delete('/account',                 ctrl.deleteUserAccount);
userRouter.post('/sos',                       features.userSOS);          // ✅ Full SOS
userRouter.patch('/language',                 features.updateUserLanguage);// ✅ Multi-lang
// Trolley response
userRouter.post('/bookings/:bookingId/trolley-response', features.respondToTrolley);
// Scheduled bookings
userRouter.get('/scheduled-bookings',         features.getScheduledBookings);
userRouter.delete('/scheduled-bookings/:bookingId', features.cancelScheduledBooking);
router.use('/user', userRouter);

// ════════════════════════════════════════════════════════════
// PORTER — /api/porter  (App only)
// ════════════════════════════════════════════════════════════
const porterRouter = require('express').Router();
porterRouter.use(authenticate, authorize('porter'), appOnly);
porterRouter.get('/profile',                  ctrl.getPorterProfile);
porterRouter.patch('/profile',                ctrl.updatePorterProfile);
porterRouter.patch('/online',                 ctrl.toggleOnline);
porterRouter.get('/wallet',                   ctrl.getWallet);
porterRouter.post('/wallet/withdraw',         ctrl.withdraw);
porterRouter.get('/earnings',                 ctrl.getEarningsSummary);
porterRouter.get('/earnings/analytics',       features.getPorterEarningsAnalytics); // ✅ Detailed analytics
porterRouter.post('/sos',                     features.porterSOS);                  // ✅ Full SOS
porterRouter.patch('/language',               features.updatePorterLanguage);        // ✅ Multi-lang
// Booking actions
porterRouter.post('/bookings/:bookingId/accept',       booking.acceptBooking);
porterRouter.post('/bookings/:bookingId/reject',       booking.rejectBooking);
porterRouter.post('/bookings/:bookingId/group-respond',features.respondGroupBooking);// ✅ Group booking
porterRouter.post('/bookings/:bookingId/verify-otp',   booking.verifyJobOTP);
porterRouter.post('/bookings/:bookingId/complete',     booking.completeJob);
porterRouter.post('/bookings/:bookingId/cancel',       booking.cancelBooking);
porterRouter.post('/bookings/:bookingId/dispute',      features.raiseDispute);        // ✅ Full dispute
porterRouter.post('/bookings/:bookingId/offer-trolley',features.offerTrolley);        // ✅ Trolley
porterRouter.get('/bookings',                          booking.getPorterBookings);
router.use('/porter', porterRouter);

// ════════════════════════════════════════════════════════════
// BOOKINGS — /api/bookings
// ════════════════════════════════════════════════════════════
const bookingRouter = require('express').Router();
// Fare preview — any authenticated user
bookingRouter.get('/fare-preview',    authenticate, authorize('user','admin','viewer'), booking.getFarePreview);
// Trolley info — before booking
bookingRouter.get('/trolley-info',    authenticate, authorize('user'), appOnly, features.getStationTrolleyInfo);
// Create booking
bookingRouter.post('/',               authenticate, authorize('user'), appOnly, booking.createBooking);
// Schedule a booking
bookingRouter.post('/:bookingId/schedule', authenticate, authorize('user'), appOnly, features.scheduleBooking); // ✅ Scheduled
// Group booking (5+ bags, user accepted 2-porter)
bookingRouter.post('/:bookingId/group',    authenticate, authorize('user'), appOnly, features.initiateGroupBooking); // ✅ Group
// My bookings
bookingRouter.get('/my',              authenticate, authorize('user'), appOnly, booking.getMyBookings);
// Cancel, rate, dispute
bookingRouter.post('/:bookingId/cancel',   authenticate, authorize('user'), appOnly, booking.cancelBooking);
bookingRouter.post('/:bookingId/rate',     authenticate, authorize('user'), appOnly, booking.submitRating);
bookingRouter.post('/:bookingId/dispute',  authenticate, authorize('user'), appOnly, features.raiseDispute); // ✅ Full dispute
router.use('/bookings', bookingRouter);

// ════════════════════════════════════════════════════════════
// PAYMENT — /api/payment
// ════════════════════════════════════════════════════════════
const paymentRouter = require('express').Router();
paymentRouter.post('/create-order', authenticate, authorize('user'), appOnly, ctrl.createOrder);
paymentRouter.post('/verify',       authenticate, authorize('user'), appOnly, ctrl.verifyPayment);
paymentRouter.post('/webhook',      ctrl.webhook);
router.use('/payment', paymentRouter);

// ════════════════════════════════════════════════════════════
// ADMIN — /api/admin  (Web + App)
// ════════════════════════════════════════════════════════════
const adminRouter = require('express').Router();
adminRouter.use(authenticate, authorize('admin'));
// Dashboard
adminRouter.get('/stats',                     admin.getStats);
adminRouter.get('/stations',                  admin.getStationStats);
// Porter management
adminRouter.get('/porters',                   admin.getPorters);
adminRouter.patch('/porters/:id/approve',     admin.approvePorter);
adminRouter.patch('/porters/:id/suspend',     admin.suspendPorter);
adminRouter.patch('/porters/:id/reactivate',  admin.reactivatePorter);
adminRouter.get('/porters/:porterId/earnings',features.getPorterEarningsAdmin); // ✅ Earnings report
// User management
adminRouter.get('/users',                     admin.getUsers);
adminRouter.patch('/users/:id/ban',           admin.banUser);
adminRouter.patch('/users/:id/unban',         admin.unbanUser);
// Bookings
adminRouter.get('/bookings',                  admin.getAllBookings);
// Fraud
adminRouter.get('/fraud-flags',               admin.getFraudFlags);
adminRouter.patch('/fraud-flags/:id/review',  admin.reviewFraudFlag);
// Surge pricing
adminRouter.get('/surge',                     admin.getSurgeConfigs);
adminRouter.post('/surge',                    admin.createSurgeConfig);
// Viewer management
adminRouter.post('/viewers',                  admin.createViewer);
// Offline fee recovery
adminRouter.get('/offline-fees-pending',      admin.getOfflineFeesPending);
// SOS management
adminRouter.get('/sos/active',                features.getActiveSOS);       // ✅ Active SOS list
adminRouter.patch('/sos/:id/resolve',         features.resolveSOS);         // ✅ Resolve SOS
// Disputes
adminRouter.get('/disputes',                  features.getDisputes);         // ✅ All disputes
adminRouter.patch('/disputes/:id/resolve',    features.resolveDispute);      // ✅ Resolve dispute
// Multi-language management
adminRouter.post('/strings',                  features.upsertString);        // ✅ Add/edit strings
// Stations trolley config
adminRouter.patch('/stations/:id/trolley',    async (req, res) => {
  try {
    const { has_trolley_service } = req.body;
    const { pool } = require('../config/db');
    await pool.query('UPDATE stations SET has_trolley_service=$1 WHERE id=$2', [has_trolley_service, req.params.id]);
    res.json({ message: 'Station trolley config updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.use('/admin', adminRouter);

// ════════════════════════════════════════════════════════════
// VIEWER — /api/viewer  (Web + App)
// ════════════════════════════════════════════════════════════
const viewerRouter = require('express').Router();
viewerRouter.use(authenticate, authorize('admin', 'viewer'));
viewerRouter.get('/bookings/:bookingId',          ctrl.getBookingById);
viewerRouter.get('/disputes',                     features.getDisputes);         // ✅ Full disputes
viewerRouter.get('/disputes/my-assignments',      features.getMyDisputeAssignments); // ✅ Viewer's own
viewerRouter.patch('/disputes/:id/resolve',       features.resolveDispute);      // ✅ With SLA
viewerRouter.get('/stalled-bookings',             ctrl.getStalledBookings);
viewerRouter.patch('/porters/:id/temp-suspend',   ctrl.tempSuspendPorter);
viewerRouter.patch('/bookings/:bookingId/cancel', ctrl.cancelStalledBooking);
viewerRouter.get('/sos/active',                   features.getActiveSOS);        // ✅ See SOS
viewerRouter.patch('/sos/:id/resolve',            features.resolveSOS);          // ✅ Resolve SOS
router.use('/viewer', viewerRouter);

// ════════════════════════════════════════════════════════════
// I18N — /api/i18n  (Public — Android fetches on startup)
// ════════════════════════════════════════════════════════════
router.get('/i18n/strings', features.getAppStrings); // No auth needed — UI strings

// ════════════════════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════════════════════
router.get('/health', (req, res) => res.json({
  status: 'OK',
  app: 'HelloCoolie API v2.1',
  tagline: 'Your Porter, Just a Hello Away!',
  features: [
    'round-robin-assignment', 'otp-handshake', 'group-booking',
    'pre-scheduled', 'trolley-addon', 'earnings-analytics',
    'fraud-detection', 'dispute-sla', 'full-sos', 'multi-language',
    'senior-women-priority', 'wallet-instant-payout'
  ],
  time: new Date().toISOString(),
}));

module.exports = router;

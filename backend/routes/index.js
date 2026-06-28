// ═══════════════════════════════════════════════════════════
//  routes/index.js — All API routes centralized
// ═══════════════════════════════════════════════════════════
const router  = require('express').Router();
const { authenticate, authorize, appOnly } = require('../middleware/auth');

// Controllers
const auth    = require('../controllers/authController');
const booking = require('../controllers/bookingController');
const admin   = require('../controllers/adminController');
const ctrl    = require('../controllers/allControllers');

// ── Aliases ────────────────────────────────────────────────
const viewer  = ctrl; // viewerController methods are in allControllers
const porter  = ctrl; // porterController methods in allControllers
const user    = ctrl; // userController methods in allControllers
const payment = ctrl; // paymentController methods in allControllers

// ════════════════════════════════════════════════════════════
// AUTH ROUTES — /api/auth
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
// USER ROUTES — /api/user  (App only)
// ════════════════════════════════════════════════════════════
const userRouter = require('express').Router();
userRouter.use(authenticate, authorize('user'), appOnly);
userRouter.get('/profile',         user.getUserProfile);
userRouter.patch('/profile',       user.updateUserProfile);
userRouter.delete('/account',      user.deleteUserAccount);
userRouter.post('/sos',            user.userSOS);
router.use('/user', userRouter);

// ════════════════════════════════════════════════════════════
// PORTER ROUTES — /api/porter  (App only)
// ════════════════════════════════════════════════════════════
const porterRouter = require('express').Router();
porterRouter.use(authenticate, authorize('porter'), appOnly);
porterRouter.get('/profile',        porter.getPorterProfile);
porterRouter.patch('/profile',      porter.updatePorterProfile);
porterRouter.patch('/online',       porter.toggleOnline);
porterRouter.get('/wallet',         porter.getWallet);
porterRouter.post('/wallet/withdraw', porter.withdraw);
porterRouter.get('/earnings',       porter.getEarningsSummary);
porterRouter.post('/sos',           porter.raiseSOS);
// Booking actions
porterRouter.post('/bookings/:bookingId/accept',     booking.acceptBooking);
porterRouter.post('/bookings/:bookingId/reject',     booking.rejectBooking);
porterRouter.post('/bookings/:bookingId/verify-otp', booking.verifyJobOTP);
porterRouter.post('/bookings/:bookingId/complete',   booking.completeJob);
porterRouter.post('/bookings/:bookingId/cancel',     booking.cancelBooking);
porterRouter.post('/bookings/:bookingId/dispute',    booking.raiseDispute);
porterRouter.get('/bookings',                        booking.getPorterBookings);
router.use('/porter', porterRouter);

// ════════════════════════════════════════════════════════════
// BOOKING ROUTES — /api/bookings  (User: App only)
// ════════════════════════════════════════════════════════════
const bookingRouter = require('express').Router();
bookingRouter.get('/fare-preview', authenticate, authorize('user','admin','viewer'), booking.getFarePreview);
bookingRouter.post('/', authenticate, authorize('user'), appOnly, booking.createBooking);
bookingRouter.get('/my', authenticate, authorize('user'), appOnly, booking.getMyBookings);
bookingRouter.post('/:bookingId/cancel', authenticate, authorize('user'), appOnly, booking.cancelBooking);
bookingRouter.post('/:bookingId/rate',   authenticate, authorize('user'), appOnly, booking.submitRating);
bookingRouter.post('/:bookingId/dispute',authenticate, authorize('user'), appOnly, booking.raiseDispute);
router.use('/bookings', bookingRouter);

// ════════════════════════════════════════════════════════════
// PAYMENT ROUTES — /api/payment
// ════════════════════════════════════════════════════════════
const paymentRouter = require('express').Router();
paymentRouter.post('/create-order',   authenticate, authorize('user'), appOnly, payment.createOrder);
paymentRouter.post('/verify',         authenticate, authorize('user'), appOnly, payment.verifyPayment);
paymentRouter.post('/webhook',        payment.webhook); // No auth — Razorpay calls this
router.use('/payment', paymentRouter);

// ════════════════════════════════════════════════════════════
// ADMIN ROUTES — /api/admin  (Web + App)
// ════════════════════════════════════════════════════════════
const adminRouter = require('express').Router();
adminRouter.use(authenticate, authorize('admin'));
adminRouter.get('/stats',                    admin.getStats);
adminRouter.get('/stations',                 admin.getStationStats);
// Porter management
adminRouter.get('/porters',                  admin.getPorters);
adminRouter.patch('/porters/:id/approve',    admin.approvePorter);
adminRouter.patch('/porters/:id/suspend',    admin.suspendPorter);
adminRouter.patch('/porters/:id/reactivate', admin.reactivatePorter);
// User management
adminRouter.get('/users',                    admin.getUsers);
adminRouter.patch('/users/:id/ban',          admin.banUser);
adminRouter.patch('/users/:id/unban',        admin.unbanUser);
// Bookings
adminRouter.get('/bookings',                 admin.getAllBookings);
// Fraud
adminRouter.get('/fraud-flags',              admin.getFraudFlags);
adminRouter.patch('/fraud-flags/:id/review', admin.reviewFraudFlag);
// Surge pricing
adminRouter.get('/surge',                    admin.getSurgeConfigs);
adminRouter.post('/surge',                   admin.createSurgeConfig);
// Viewer management
adminRouter.post('/viewers',                 admin.createViewer);
// Offline fees
adminRouter.get('/offline-fees-pending',     admin.getOfflineFeesPending);
router.use('/admin', adminRouter);

// ════════════════════════════════════════════════════════════
// VIEWER ROUTES — /api/viewer  (Web + App)
// ════════════════════════════════════════════════════════════
const viewerRouter = require('express').Router();
viewerRouter.use(authenticate, authorize('admin', 'viewer'));
viewerRouter.get('/bookings/:bookingId',           viewer.getBookingById);
viewerRouter.get('/disputes',                      viewer.getDisputes);
viewerRouter.patch('/disputes/:id/resolve',        viewer.resolveDispute);
viewerRouter.get('/stalled-bookings',              viewer.getStalledBookings);
viewerRouter.patch('/porters/:id/temp-suspend',    viewer.tempSuspendPorter);
viewerRouter.patch('/bookings/:bookingId/cancel',  viewer.cancelStalledBooking);
router.use('/viewer', viewerRouter);

// ════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════
router.get('/health', (req, res) => res.json({
  status: 'OK',
  app: 'HelloCoolie API v2.0',
  tagline: 'Your Porter, Just a Hello Away!',
  time: new Date().toISOString(),
}));

module.exports = router;

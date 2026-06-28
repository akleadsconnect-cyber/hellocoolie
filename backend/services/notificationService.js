// Notification Service — FCM Push + WhatsApp Fallback
// In production: integrate Firebase Admin SDK + WhatsApp Business API

const sendPush = async (fcmToken, { title, body, data = {} }) => {
  if (!fcmToken) return;
  try {
    // TODO: Replace with Firebase Admin SDK call
    // await admin.messaging().send({ token: fcmToken, notification: { title, body }, data });
    console.log(`📱 Push → ${fcmToken?.slice(0,20)}... | ${title}`);
    return { success: true };
  } catch (err) {
    console.error('Push notification failed:', err.message);
    return { success: false };
  }
};

const sendPushToPorter = async (fcmToken, payload) => sendPush(fcmToken, payload);
const sendPushToUser   = async (fcmToken, payload) => sendPush(fcmToken, payload);

// SMS via MSG91
const sendSMS = async (phone, message) => {
  if (!process.env.MSG91_AUTH_KEY) return;
  try {
    const axios = require('axios');
    await axios.post('https://api.msg91.com/api/v5/otp', {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${phone}`,
      authkey: process.env.MSG91_AUTH_KEY,
      otp: message,
    });
    return { success: true };
  } catch (err) {
    console.error('SMS failed:', err.message);
    return { success: false };
  }
};

// OTP via MSG91
const sendOTP = async (phone, otp) => {
  console.log(`📨 OTP ${otp} → +91${phone}`);
  return sendSMS(phone, otp);
};

// WhatsApp via Meta Business API (fallback for porters)
const sendWhatsApp = async (phone, message) => {
  console.log(`💬 WhatsApp → ${phone}: ${message}`);
  // TODO: integrate Meta WhatsApp Business API
  return { success: true };
};

// Booking status notifications
const notifyBookingStatus = async ({ user, porter, status, bookingId, extras = {} }) => {
  const msgs = {
    accepted:     { u: `✅ Porter ${extras.porterName} accepted your booking #${bookingId}`, p: null },
    in_progress:  { u: `🧳 Job started! Porter is carrying your bags.`, p: null },
    completed:    { u: `✅ Job done! Rate your porter.`, p: `💰 ₹${extras.amount} credited to your wallet!` },
    cancelled_by_user:  { u: null, p: `❌ User cancelled booking #${bookingId}` },
    cancelled_by_porter:{ u: `❌ Porter cancelled booking #${bookingId}. Finding another...`, p: null },
    expired:      { u: `😔 No porter found near ${extras.station}. Full refund initiated.`, p: null },
  };
  const msg = msgs[status];
  if (!msg) return;
  if (msg.u && user?.fcm_token) await sendPushToUser(user.fcm_token, { title: 'HelloCoolie', body: msg.u, data: { bookingId } });
  if (msg.p && porter?.fcm_token) await sendPushToPorter(porter.fcm_token, { title: 'HelloCoolie', body: msg.p, data: { bookingId } });
  if (msg.p && porter?.whatsapp_no) await sendWhatsApp(porter.whatsapp_no, msg.p);
};

module.exports = { sendPush, sendPushToPorter, sendPushToUser, sendSMS, sendOTP, sendWhatsApp, notifyBookingStatus };

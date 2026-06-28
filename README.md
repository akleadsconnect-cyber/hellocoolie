# HelloCoolie 🚉
### *"Your Porter, Just a Hello Away!"*

Pan-India Railway Porter Marketplace — connecting passengers with verified licensed porters at railway stations.

---

## 📁 Project Structure

```
hellocoolie/
├── backend/                    ← Node.js + Express REST API + Socket.IO
│   ├── server.js               ← Entry point, Socket.IO, Cron jobs
│   ├── routes/index.js         ← ALL routes centralized
│   ├── controllers/
│   │   ├── authController.js   ← All 4 account types auth
│   │   ├── bookingController.js← Full booking lifecycle
│   │   ├── adminController.js  ← Platform management
│   │   └── allControllers.js   ← Porter, User, Viewer, Payment
│   ├── services/
│   │   ├── pricingService.js       ← Fare calculation engine
│   │   ├── bookingAssignmentService.js ← Round-robin + priority matching
│   │   ├── cancellationService.js  ← Fee logic + fraud detection
│   │   ├── walletService.js        ← Instant payouts
│   │   └── notificationService.js  ← FCM + WhatsApp + SMS
│   ├── middleware/auth.js       ← JWT + Role guards + App-only
│   └── config/
│       ├── db.js               ← PostgreSQL pool
│       └── schema.sql          ← Complete database schema
│
├── android/                    ← Kotlin Android App (coming next)
│   └── app/src/main/
│       ├── java/in/hellocoolie/
│       │   ├── ui/             ← Activities per role
│       │   ├── data/           ← Models, API, Repository
│       │   └── services/       ← Socket.IO, Notifications
│       └── res/                ← Layouts, drawables, strings
│
└── web/                        ← React Web (Admin + Viewer)
    └── src/
        ├── components/admin/   ← Admin dashboard
        ├── components/viewer/  ← Viewer portal
        └── pages/              ← Auth pages
```

---

## 👥 4 Account Types

| Role | Login | Platform | Reset Password |
|------|-------|----------|----------------|
| **Admin** | Email + Password | Web + App | Email + PAN No. |
| **Viewer** | Email + Password | Web + App | Email + PAN No. |
| **Porter** | Mobile No. + Password | App ONLY | Aadhaar No. + DOB |
| **User** | Mobile No. + Password | App ONLY | DOB |

---

## 🔄 Booking Lifecycle

```
User Creates Booking
       ↓
   PENDING → Round-robin notifies porters (30 sec timer each)
       ↓
   ACCEPTED → Porter accepted. OTP generated.
       ↓         User sees OTP. Porter contact NOT revealed yet.
   IN_PROGRESS → Porter enters OTP. Job starts.
       ↓           Both contacts revealed NOW.
   COMPLETED → Porter marks done. Payment released to wallet.
       ↓
   Rate & Review
```

---

## 💰 Pricing Engine

```
Total = Base Fare + Bag Fare + Distance Fare

Base Fare:     ₹80 (all cities)
Bag Fare:      Normal ₹40 | Medium ₹50 | Heavy ₹60 | Very Heavy ₹80 (per bag)
Distance:      Platform ₹0 | Exit ₹40 | Auto Stand ₹80

Platform Fee:
  City X:      20% (normal) | 25% (festival)
  City Y/Z:    15% (normal) | 25% (festival)

Porter gets:   (100% - platform_fee%) of total
```

---

## 📦 Porter Priority Algorithm

For **2–3 bags**:
- Senior/experienced porters get priority (experience_years × 2 points)
- High rating bonus (rating × 5 points)

For **4 bags**:
- Max limit per porter (hard cap)

For **5+ bags**:
- App suggests 2 porters
- User can accept or decline

For **Very Heavy** bags:
- Only porters with `can_carry_very_heavy = TRUE` are shown

---

## 🔄 Round Robin Assignment

1. Get all eligible porters at arrival station (online, approved, not on job)
2. Sort by: fewest bookings first (fair distribution)
3. Apply priority score (experience + rating + bag capability)
4. Notify top porter — 30 second timer
5. If rejected/expired → next porter
6. If no porters → booking expires, full refund

---

## 🚫 Fraud Detection

- Porter cancels **3+ times in 7 days** → Auto-flagged
- Pattern: Accept booking → view user contact → cancel = suspected direct dealing
- **Contact reveal only after OTP** — prevents contact-based direct dealing
- Auto-suspend at **6+ cancellations in 7 days**
- Viewer/Admin can review flags and reactivate

---

## 💳 Offline (Cash) Payment Flow

1. User selects "Pay Cash"
2. Porter sees "CASH" tag on booking
3. Porter completes job → marks "Cash Received"
4. Platform fee (15–25%) deducted from porter's wallet balance
5. If insufficient wallet → scheduled recovery
6. Admin can see all pending offline fee recoveries

---

## ❌ Cancellation Policy

| When | Fee |
|------|-----|
| Train arriving in **>15 minutes** | FREE |
| Train arriving in **≤15 minutes** | 15% of fare |
| Train **already arrived** | 15% of fare |

- User cancels → fee from user
- Porter cancels → fee from porter wallet

---

## 🛠️ Tech Stack

- **Backend**: Node.js + Express + Socket.IO
- **Database**: PostgreSQL (Neon cloud)
- **Auth**: JWT + OTP (MSG91)
- **Payments**: Razorpay (orders + payouts + webhooks)
- **Notifications**: Firebase FCM + WhatsApp Business API
- **Android**: Kotlin + Retrofit + Socket.IO client
- **Web**: React.js (Admin + Viewer only)
- **Hosting**: Render (backend) + GitHub Pages (web)

---

## 🚀 Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Fill in DATABASE_URL, RAZORPAY keys, etc.
node server.js
```

---

## 📡 API Reference

All endpoints at `/api/`

### Auth
| POST | `/auth/user/register` | User signup |
| POST | `/auth/user/login` | User login |
| POST | `/auth/porter/register` | Porter signup |
| POST | `/auth/porter/login` | Porter login |
| POST | `/auth/admin/login` | Admin login |
| POST | `/auth/viewer/login` | Viewer login |
| POST | `/auth/send-otp` | Send OTP |
| POST | `/auth/reset-password` | Reset password |

### Bookings
| GET  | `/bookings/fare-preview` | Get fare before booking |
| POST | `/bookings` | Create booking |
| GET  | `/bookings/my` | My bookings (user) |
| POST | `/bookings/:id/cancel` | Cancel booking |
| POST | `/bookings/:id/rate` | Rate porter |

### Porter
| PATCH | `/porter/online` | Toggle online/offline |
| GET   | `/porter/wallet` | Wallet balance + history |
| POST  | `/porter/wallet/withdraw` | Instant withdrawal |
| POST  | `/porter/bookings/:id/accept` | Accept booking |
| POST  | `/porter/bookings/:id/verify-otp` | Verify job OTP |
| POST  | `/porter/bookings/:id/complete` | Mark job complete |

### Admin
| GET  | `/admin/stats` | Dashboard stats |
| GET  | `/admin/stations` | Station-wise analytics |
| GET  | `/admin/porters` | All porters |
| PATCH | `/admin/porters/:id/approve` | Approve porter |
| GET  | `/admin/fraud-flags` | Fraud alerts |
| POST | `/admin/surge` | Create festival surge pricing |

---

*HelloCoolie | Akshay Rai | June 2026 | "Your Porter, Just a Hello Away!"*

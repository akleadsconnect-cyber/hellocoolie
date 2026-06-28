-- ═══════════════════════════════════════════════════════════
--  HelloCoolie — Complete Database Schema
--  "Your Porter, Just a Hello Away!"
-- ═══════════════════════════════════════════════════════════

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUMS ────────────────────────────────────────────────────
CREATE TYPE account_role       AS ENUM ('admin', 'viewer', 'porter', 'user');
CREATE TYPE porter_status      AS ENUM ('pending', 'approved', 'suspended', 'reactivated');
CREATE TYPE shift_type         AS ENUM ('8hr', '12hr');
CREATE TYPE booking_status     AS ENUM ('pending','accepted','otp_confirmed','in_progress','completed','cancelled_by_user','cancelled_by_porter','expired','disputed');
CREATE TYPE payment_method     AS ENUM ('online', 'cash');
CREATE TYPE payment_status     AS ENUM ('pending','paid','refunded','recovery_pending','recovered');
CREATE TYPE bag_weight         AS ENUM ('normal', 'medium', 'heavy', 'very_heavy');
CREATE TYPE season_type        AS ENUM ('normal', 'festival');
CREATE TYPE city_tier          AS ENUM ('x', 'y', 'z');
CREATE TYPE cancel_reason_type AS ENUM ('user_cancel','porter_cancel','no_porter','dispute');
CREATE TYPE fraud_flag_type    AS ENUM ('frequent_cancel','direct_deal_suspected','abusive','other');
CREATE TYPE withdrawal_status  AS ENUM ('pending','processed','failed');
CREATE TYPE booking_for        AS ENUM ('myself','other');

-- ════════════════════════════════════════════════════════════
-- 1. USERS (passengers)
-- ════════════════════════════════════════════════════════════
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100) NOT NULL,
  phone             VARCHAR(15)  UNIQUE NOT NULL,        -- also username
  password_hash     VARCHAR(255) NOT NULL,
  date_of_birth     DATE         NOT NULL,               -- for password reset
  gender            VARCHAR(10),
  is_senior         BOOLEAN      DEFAULT FALSE,
  is_active         BOOLEAN      DEFAULT TRUE,
  is_banned         BOOLEAN      DEFAULT FALSE,
  fcm_token         TEXT,                                -- push notification token
  whatsapp_no       VARCHAR(15),
  preferred_lang    VARCHAR(5)   DEFAULT 'hi',           -- hi / en
  total_bookings    INTEGER      DEFAULT 0,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 2. PORTERS
-- ════════════════════════════════════════════════════════════
CREATE TABLE porters (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR(100) NOT NULL,
  phone                 VARCHAR(15)  UNIQUE NOT NULL,       -- also username
  password_hash         VARCHAR(255) NOT NULL,
  aadhaar_no            VARCHAR(20)  UNIQUE NOT NULL,       -- for password reset
  date_of_birth         DATE         NOT NULL,
  gender                VARCHAR(10),
  address               TEXT,
  emergency_contact     VARCHAR(15)  NOT NULL,
  blood_group           VARCHAR(5),
  badge_no              VARCHAR(30)  UNIQUE NOT NULL,
  station               VARCHAR(150) NOT NULL,
  station_city          VARCHAR(100),
  city_tier             city_tier    DEFAULT 'y',           -- pricing tier
  shift_type            shift_type   DEFAULT '8hr',
  shift_start           TIME,
  shift_end             TIME,
  is_online             BOOLEAN      DEFAULT FALSE,
  is_on_job             BOOLEAN      DEFAULT FALSE,
  status                porter_status DEFAULT 'pending',
  approved_by           UUID,                               -- admin id
  approved_at           TIMESTAMPTZ,
  suspended_by          UUID,
  suspended_at          TIMESTAMPTZ,
  suspend_reason        TEXT,
  -- Stats
  rating                DECIMAL(3,2) DEFAULT 0.00,
  total_ratings         INTEGER      DEFAULT 0,
  total_bookings        INTEGER      DEFAULT 0,
  total_cancellations   INTEGER      DEFAULT 0,
  fraud_flag_count      INTEGER      DEFAULT 0,
  experience_years      INTEGER      DEFAULT 0,
  -- Strength (for bag weight priority)
  can_carry_very_heavy  BOOLEAN      DEFAULT FALSE,
  -- Wallet
  wallet_balance        DECIMAL(12,2) DEFAULT 0.00,
  upi_id                VARCHAR(100),
  bank_account          VARCHAR(30),
  bank_ifsc             VARCHAR(15),
  -- Documents
  aadhaar_photo_url     TEXT,
  badge_photo_url       TEXT,
  face_photo_url        TEXT,
  -- Notifications
  fcm_token             TEXT,
  whatsapp_no           VARCHAR(15),
  -- Meta
  is_active             BOOLEAN      DEFAULT TRUE,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 3. ADMINS
-- ════════════════════════════════════════════════════════════
CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  pan_no        VARCHAR(15)  UNIQUE NOT NULL,               -- for password reset
  date_of_birth DATE         NOT NULL,                      -- for password reset
  password_hash VARCHAR(255) NOT NULL,
  role          account_role DEFAULT 'admin',
  is_active     BOOLEAN      DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 4. VIEWERS
-- ════════════════════════════════════════════════════════════
CREATE TABLE viewers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  pan_no        VARCHAR(15)  UNIQUE NOT NULL,
  date_of_birth DATE         NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          account_role DEFAULT 'viewer',
  created_by    UUID         REFERENCES admins(id),
  is_active     BOOLEAN      DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 5. OTP STORE
-- ════════════════════════════════════════════════════════════
CREATE TABLE otp_store (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier  VARCHAR(150) NOT NULL,   -- phone or email
  otp         VARCHAR(6)   NOT NULL,
  purpose     VARCHAR(30)  NOT NULL,   -- login / reset_password / job_start
  role        account_role,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used        BOOLEAN      DEFAULT FALSE,
  attempts    INTEGER      DEFAULT 0,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 6. STATIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE stations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(150) UNIQUE NOT NULL,
  code          VARCHAR(10)  UNIQUE NOT NULL,   -- e.g. NDLS, CSTM
  city          VARCHAR(100) NOT NULL,
  state         VARCHAR(100),
  city_tier     city_tier    DEFAULT 'y',
  zone          VARCHAR(50),                    -- Northern, Western, etc.
  category      VARCHAR(5)   DEFAULT 'A',       -- A1, A, B, C
  total_porters INTEGER      DEFAULT 0,
  is_active     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 7. SURGE PRICING CONFIG (admin managed)
-- ════════════════════════════════════════════════════════════
CREATE TABLE surge_config (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(100) NOT NULL,   -- "Diwali 2026", "Holi 2026"
  start_date          DATE         NOT NULL,
  end_date            DATE         NOT NULL,
  season_type         season_type  DEFAULT 'festival',
  platform_fee_pct    DECIMAL(5,2) DEFAULT 25.00,  -- 25% festival
  base_fare_override  DECIMAL(10,2),               -- NULL = use city tier default
  is_active           BOOLEAN      DEFAULT TRUE,
  created_by          UUID         REFERENCES admins(id),
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- City tier pricing config
CREATE TABLE city_tier_pricing (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_tier           city_tier    UNIQUE NOT NULL,
  platform_fee_pct    DECIMAL(5,2) NOT NULL,    -- x=20, y=15, z=15
  base_fare           DECIMAL(10,2) DEFAULT 80.00,
  bag_fare_normal     DECIMAL(10,2) DEFAULT 40.00,
  bag_fare_medium     DECIMAL(10,2) DEFAULT 50.00,
  bag_fare_heavy      DECIMAL(10,2) DEFAULT 60.00,
  bag_fare_very_heavy DECIMAL(10,2) DEFAULT 80.00,
  distance_platform   DECIMAL(10,2) DEFAULT 0.00,
  distance_exit       DECIMAL(10,2) DEFAULT 40.00,
  distance_auto       DECIMAL(10,2) DEFAULT 80.00,
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 8. BOOKINGS
-- ════════════════════════════════════════════════════════════
CREATE TABLE bookings (
  id                    VARCHAR(25) PRIMARY KEY,   -- BK2026XXXXXXXX

  -- Who booked
  user_id               UUID         REFERENCES users(id),
  booking_for           booking_for  DEFAULT 'myself',
  -- Traveller details (could be "other")
  traveller_name        VARCHAR(100) NOT NULL,
  traveller_phone       VARCHAR(15)  NOT NULL,
  traveller_age         INTEGER,
  traveller_gender      VARCHAR(10),
  is_senior             BOOLEAN      DEFAULT FALSE,
  is_woman_solo         BOOLEAN      DEFAULT FALSE,

  -- Train details
  train_no              VARCHAR(20),
  train_name            VARCHAR(150),
  from_station          VARCHAR(150) NOT NULL,
  to_station            VARCHAR(150) NOT NULL,
  arrival_station       VARCHAR(150) NOT NULL,    -- where coolie needed
  arrival_time          TIMESTAMPTZ,
  coach                 VARCHAR(10),
  seat_no               VARCHAR(10),
  pnr                   VARCHAR(15),

  -- Porter assigned
  porter_id             UUID         REFERENCES porters(id),
  porter_name           VARCHAR(100),
  porter_phone          VARCHAR(15),              -- revealed after OTP handshake
  second_porter_id      UUID         REFERENCES porters(id),  -- for 5+ bags

  -- Bags
  bag_count             INTEGER      NOT NULL DEFAULT 1,
  bag_weight            bag_weight   DEFAULT 'normal',
  bag_details           TEXT,                     -- light/heavy/mixed description
  two_porter_suggested  BOOLEAN      DEFAULT FALSE,
  two_porter_accepted   BOOLEAN      DEFAULT FALSE,
  drop_location         VARCHAR(30)  DEFAULT 'platform',  -- platform/exit/auto

  -- Pricing
  city_tier             city_tier    DEFAULT 'y',
  season_type           season_type  DEFAULT 'normal',
  base_fare             DECIMAL(10,2) NOT NULL,
  bag_fare              DECIMAL(10,2) DEFAULT 0,
  distance_fare         DECIMAL(10,2) DEFAULT 0,
  surge_pct             DECIMAL(5,2)  DEFAULT 0,
  subtotal              DECIMAL(10,2) NOT NULL,
  platform_fee_pct      DECIMAL(5,2)  NOT NULL,
  platform_fee          DECIMAL(10,2) NOT NULL,
  porter_amount         DECIMAL(10,2) NOT NULL,
  total_amount          DECIMAL(10,2) NOT NULL,

  -- Payment
  payment_method        payment_method DEFAULT 'online',
  payment_status        payment_status DEFAULT 'pending',
  razorpay_order_id     VARCHAR(100),
  razorpay_payment_id   VARCHAR(100),
  offline_fee_recovered BOOLEAN        DEFAULT FALSE,

  -- Booking status
  status                booking_status DEFAULT 'pending',
  otp_code              VARCHAR(6),               -- job start OTP
  otp_verified_at       TIMESTAMPTZ,

  -- Cancellation
  cancelled_by          VARCHAR(10),              -- 'user' or 'porter'
  cancel_reason         TEXT,
  cancel_fee            DECIMAL(10,2) DEFAULT 0,
  cancel_fee_charged    BOOLEAN       DEFAULT FALSE,

  -- Round-robin tracking
  round_robin_index     INTEGER       DEFAULT 0,
  notified_porter_ids   UUID[],                   -- porters already notified
  current_notify_porter UUID,                     -- currently notified porter
  notify_expires_at     TIMESTAMPTZ,              -- 30-second timer

  -- Timestamps
  accepted_at           TIMESTAMPTZ,
  otp_confirmed_at      TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  expired_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 9. BOOKING NOTIFICATION QUEUE (30-sec round robin)
-- ════════════════════════════════════════════════════════════
CREATE TABLE booking_notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    VARCHAR(25)  REFERENCES bookings(id),
  porter_id     UUID         REFERENCES porters(id),
  notified_at   TIMESTAMPTZ  DEFAULT NOW(),
  expires_at    TIMESTAMPTZ  NOT NULL,             -- notified_at + 30 seconds
  response      VARCHAR(10),                       -- 'accepted' / 'rejected' / 'expired'
  responded_at  TIMESTAMPTZ
);

-- ════════════════════════════════════════════════════════════
-- 10. RATINGS & REVIEWS
-- ════════════════════════════════════════════════════════════
CREATE TABLE ratings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    VARCHAR(25)  UNIQUE REFERENCES bookings(id),
  user_id       UUID         REFERENCES users(id),
  porter_id     UUID         REFERENCES porters(id),
  -- User rates porter
  porter_rating INTEGER      CHECK (porter_rating BETWEEN 1 AND 5),
  porter_review TEXT,
  porter_tags   TEXT[],      -- ['on_time','careful','helpful','friendly']
  -- Porter rates user
  user_rating   INTEGER      CHECK (user_rating BETWEEN 1 AND 5),
  user_tags     TEXT[],      -- ['respectful','good_tipper','clear_instructions']
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 11. PORTER WALLET & TRANSACTIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE wallet_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  porter_id       UUID         REFERENCES porters(id),
  booking_id      VARCHAR(25)  REFERENCES bookings(id),
  type            VARCHAR(20)  NOT NULL,  -- credit/debit/withdrawal/penalty/recovery
  amount          DECIMAL(12,2) NOT NULL,
  balance_before  DECIMAL(12,2) NOT NULL,
  balance_after   DECIMAL(12,2) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE withdrawals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  porter_id   UUID         REFERENCES porters(id),
  amount      DECIMAL(12,2) NOT NULL,
  upi_id      VARCHAR(100),
  status      withdrawal_status DEFAULT 'pending',
  razorpay_payout_id VARCHAR(100),
  processed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 12. CANCELLATIONS LOG
-- ════════════════════════════════════════════════════════════
CREATE TABLE cancellations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      VARCHAR(25)  REFERENCES bookings(id),
  cancelled_by    VARCHAR(10)  NOT NULL,      -- 'user' or 'porter'
  user_id         UUID         REFERENCES users(id),
  porter_id       UUID         REFERENCES porters(id),
  reason          TEXT,
  fee_applicable  BOOLEAN      DEFAULT FALSE,
  fee_amount      DECIMAL(10,2) DEFAULT 0,
  fee_charged     BOOLEAN      DEFAULT FALSE,
  minutes_to_arrival INTEGER,                 -- how many mins before train
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 13. FRAUD FLAGS
-- ════════════════════════════════════════════════════════════
CREATE TABLE fraud_flags (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  porter_id     UUID         REFERENCES porters(id),
  flag_type     fraud_flag_type NOT NULL,
  booking_id    VARCHAR(25)  REFERENCES bookings(id),
  description   TEXT,
  auto_flagged  BOOLEAN      DEFAULT TRUE,
  reviewed_by   UUID,                         -- admin/viewer id
  reviewed_at   TIMESTAMPTZ,
  action_taken  TEXT,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 14. DISPUTES
-- ════════════════════════════════════════════════════════════
CREATE TABLE disputes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      VARCHAR(25)  REFERENCES bookings(id),
  raised_by       VARCHAR(10)  NOT NULL,   -- 'user' or 'porter'
  user_id         UUID         REFERENCES users(id),
  porter_id       UUID         REFERENCES porters(id),
  description     TEXT         NOT NULL,
  status          VARCHAR(20)  DEFAULT 'open',  -- open/investigating/resolved/closed
  assigned_to     UUID,                          -- viewer id
  resolution      TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 15. SOS ALERTS
-- ════════════════════════════════════════════════════════════
CREATE TABLE sos_alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raised_by   VARCHAR(10)  NOT NULL,   -- 'user' or 'porter'
  user_id     UUID         REFERENCES users(id),
  porter_id   UUID         REFERENCES porters(id),
  booking_id  VARCHAR(25)  REFERENCES bookings(id),
  location    TEXT,
  status      VARCHAR(20)  DEFAULT 'active',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 16. AUDIT LOG
-- ════════════════════════════════════════════════════════════
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID         NOT NULL,
  actor_role  account_role NOT NULL,
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(50),
  entity_id   VARCHAR(100),
  details     JSONB,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- INDEXES (performance)
-- ════════════════════════════════════════════════════════════
CREATE INDEX idx_users_phone            ON users(phone);
CREATE INDEX idx_porters_phone          ON porters(phone);
CREATE INDEX idx_porters_station        ON porters(station);
CREATE INDEX idx_porters_status         ON porters(status);
CREATE INDEX idx_porters_is_online      ON porters(is_online);
CREATE INDEX idx_bookings_status        ON bookings(status);
CREATE INDEX idx_bookings_user          ON bookings(user_id);
CREATE INDEX idx_bookings_porter        ON bookings(porter_id);
CREATE INDEX idx_bookings_created       ON bookings(created_at DESC);
CREATE INDEX idx_booking_notifs_booking ON booking_notifications(booking_id);
CREATE INDEX idx_booking_notifs_porter  ON booking_notifications(porter_id);
CREATE INDEX idx_wallet_porter          ON wallet_transactions(porter_id);
CREATE INDEX idx_fraud_porter           ON fraud_flags(porter_id);
CREATE INDEX idx_otp_identifier         ON otp_store(identifier);

-- ════════════════════════════════════════════════════════════
-- SEED: City Tier Pricing
-- ════════════════════════════════════════════════════════════
INSERT INTO city_tier_pricing (city_tier, platform_fee_pct, base_fare, bag_fare_normal, bag_fare_medium, bag_fare_heavy, bag_fare_very_heavy)
VALUES
  ('x', 20.00, 80.00, 40.00, 50.00, 60.00, 80.00),
  ('y', 15.00, 80.00, 40.00, 50.00, 60.00, 80.00),
  ('z', 15.00, 80.00, 40.00, 50.00, 60.00, 80.00);

-- SEED: Admin
-- Password: Admin@123 (bcrypt hash — update before deploy)
INSERT INTO admins (name, email, pan_no, date_of_birth, password_hash, role)
VALUES ('Super Admin', 'admin@hellocoolie.in', 'ABCPA1234A', '1990-01-01',
        '$2b$10$placeholder_replace_with_real_hash', 'admin');

-- ═══════════════════════════════════════════════════════════
--  HelloCoolie — Schema Additions v2.1
--  Run this AFTER schema.sql
-- ═══════════════════════════════════════════════════════════

-- ── 1. Trolley support ────────────────────────────────────────
ALTER TABLE porters ADD COLUMN IF NOT EXISTS has_trolley BOOLEAN DEFAULT FALSE;
ALTER TABLE porters ADD COLUMN IF NOT EXISTS trolley_charge DECIMAL(10,2) DEFAULT 0;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS needs_trolley BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trolley_charge DECIMAL(10,2) DEFAULT 0;

ALTER TABLE stations ADD COLUMN IF NOT EXISTS has_trolley_service BOOLEAN DEFAULT FALSE;

-- ── 2. Group booking (2 porters simultaneously) ───────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_group_booking BOOLEAN DEFAULT FALSE;
-- second_porter_id already in schema.sql
-- Add group booking request status per porter
CREATE TABLE IF NOT EXISTS group_booking_porters (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    VARCHAR(25) REFERENCES bookings(id),
  porter_id     UUID        REFERENCES porters(id),
  porter_number INTEGER     DEFAULT 1,  -- 1 or 2
  status        VARCHAR(20) DEFAULT 'pending',  -- pending/accepted/rejected
  accepted_at   TIMESTAMPTZ,
  porter_amount DECIMAL(10,2),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Pre-scheduled bookings ─────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;  -- when to start notifying porters
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS schedule_status VARCHAR(20) DEFAULT 'immediate';
-- schedule_status: 'immediate' | 'scheduled' | 'dispatched' | 'expired'

-- ── 4. Dispute SLA tracking ──────────────────────────────────
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT FALSE;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS auto_assigned_at TIMESTAMPTZ;

-- Update existing disputes to have SLA
UPDATE disputes SET sla_deadline = created_at + INTERVAL '2 hours' WHERE sla_deadline IS NULL;

-- ── 5. SOS - better tracking ──────────────────────────────────
ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);
ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS emergency_notified BOOLEAN DEFAULT FALSE;
ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS admin_notified BOOLEAN DEFAULT FALSE;
ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(15);

-- ── 6. Porter earnings analytics ─────────────────────────────
CREATE TABLE IF NOT EXISTS porter_daily_earnings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  porter_id   UUID        REFERENCES porters(id),
  date        DATE        NOT NULL,
  bookings    INTEGER     DEFAULT 0,
  earnings    DECIMAL(12,2) DEFAULT 0,
  UNIQUE(porter_id, date)
);

-- Trigger to update daily earnings on wallet credit
CREATE OR REPLACE FUNCTION update_daily_earnings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'credit' THEN
    INSERT INTO porter_daily_earnings (porter_id, date, bookings, earnings)
    VALUES (NEW.porter_id, CURRENT_DATE, 1, NEW.amount)
    ON CONFLICT (porter_id, date)
    DO UPDATE SET
      bookings = porter_daily_earnings.bookings + 1,
      earnings = porter_daily_earnings.earnings + NEW.amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_earnings ON wallet_transactions;
CREATE TRIGGER trg_daily_earnings
  AFTER INSERT ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION update_daily_earnings();

-- ── 7. Multi-language strings table ──────────────────────────
CREATE TABLE IF NOT EXISTS app_strings (
  key       VARCHAR(100) NOT NULL,
  lang      VARCHAR(5)   NOT NULL,  -- 'en' | 'hi'
  value     TEXT         NOT NULL,
  PRIMARY KEY (key, lang)
);

-- Seed Hindi + English strings
INSERT INTO app_strings (key, lang, value) VALUES
  ('booking_request_title', 'en', 'New Booking Request!'),
  ('booking_request_title', 'hi', 'नई बुकिंग!'),
  ('booking_request_body',  'en', 'bags at . ₹ for you. Accept in 30 sec!'),
  ('booking_request_body',  'hi', 'बैग्स . ₹ मिलेंगे। 30 सेकंड में स्वीकार करें!'),
  ('accept',   'en', 'Accept'), ('accept',   'hi', 'स्वीकार करें'),
  ('reject',   'en', 'Reject'), ('reject',   'hi', 'अस्वीकार करें'),
  ('go_online','en', 'Go Online'), ('go_online','hi', 'ऑनलाइन जाएं'),
  ('go_offline','en', 'Go Offline'), ('go_offline','hi', 'ऑफलाइन जाएं'),
  ('job_done', 'en', 'Mark Job Done'), ('job_done', 'hi', 'काम पूरा हुआ'),
  ('enter_otp','en', 'Enter OTP'), ('enter_otp','hi', 'OTP डालें'),
  ('sos',      'en', 'SOS Emergency'), ('sos',      'hi', 'आपातकालीन'),
  ('earnings_today', 'en', 'Today''s Earnings'), ('earnings_today', 'hi', 'आज की कमाई'),
  ('total_bags', 'en', 'Total Bags'), ('total_bags', 'hi', 'कुल बैग'),
  ('platform_only','en','Platform Only'),('platform_only','hi','प्लेटफॉर्म तक'),
  ('exit_gate','en','Station Exit'),('exit_gate','hi','स्टेशन गेट तक'),
  ('auto_stand','en','Auto Stand'),('auto_stand','hi','ऑटो स्टैंड तक'),
  ('senior_citizen','en','Senior Citizen'),('senior_citizen','hi','वरिष्ठ नागरिक'),
  ('woman_solo','en','Woman Travelling Alone'),('woman_solo','hi','अकेली महिला यात्री'),
  ('trolley_service','en','Trolley Service'),('trolley_service','hi','ट्रॉली सेवा'),
  ('booking_confirmed','en','Booking Confirmed!'),('booking_confirmed','hi','बुकिंग हो गई!'),
  ('porter_on_way','en','Porter is on the way'),('porter_on_way','hi','कुली आ रहा है'),
  ('show_otp_to_porter','en','Show this OTP to porter'),('show_otp_to_porter','hi','कुली को यह OTP दिखाएं')
ON CONFLICT (key, lang) DO NOTHING;

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_group_booking ON group_booking_porters(booking_id);
CREATE INDEX IF NOT EXISTS idx_daily_earnings ON porter_daily_earnings(porter_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_sla ON disputes(sla_deadline) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON bookings(scheduled_for) WHERE is_scheduled = TRUE;

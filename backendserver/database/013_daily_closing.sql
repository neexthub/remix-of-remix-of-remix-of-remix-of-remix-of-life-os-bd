-- Daily closing: direct referral is paid at activation; generation and matching are calculated by the
-- Bangladesh-midnight closing. Additive only; no balance rows change.
ALTER TABLE lo_activations ADD COLUMN business_date DATE NULL;
ALTER TABLE lo_activations ADD COLUMN closed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE lo_activations ADD COLUMN closed_at TIMESTAMP NULL;
ALTER TABLE lo_activations ADD KEY idx_closing (processed, closed, business_date);
-- Activations settled by the earlier all-at-once engine (and imported old-site activations) already received
-- every commission, so they are closed. This migration runs exactly once.
UPDATE lo_activations SET closed = 1, closed_at = processed_at, business_date = DATE(COALESCE(processed_at, created_at)) WHERE processed = 1;

-- Today's new binary volume per upline (Major/Minor link daily counters). Rows of a closed day are deleted.
CREATE TABLE IF NOT EXISTS lo_daily_volume (
  user_id INT UNSIGNED NOT NULL,
  vol_date DATE NOT NULL,
  left_new INT UNSIGNED NOT NULL DEFAULT 0,
  right_new INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, vol_date),
  KEY (vol_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lo_daily_closings (
  closing_date DATE PRIMARY KEY,
  status ENUM('RUNNING','DONE') NOT NULL DEFAULT 'RUNNING',
  activations INT UNSIGNED NOT NULL DEFAULT 0,
  matching_events INT UNSIGNED NOT NULL DEFAULT 0,
  matching_paid DECIMAL(16,6) NOT NULL DEFAULT 0,
  generation_paid DECIMAL(16,6) NOT NULL DEFAULT 0,
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL
) ENGINE=InnoDB;

-- System error log: successful activations that did not generate an expected commission.
CREATE TABLE IF NOT EXISTS lo_system_errors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activation_id BIGINT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  code VARCHAR(40) NOT NULL,
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_activation_code (activation_id, code),
  KEY (created_at)
) ENGINE=InnoDB;

-- Old-site matching history kept separately from new-plan events (shown as Binary / Enrollment matching).
ALTER TABLE lo_tree ADD COLUMN legacy_binary_matchings INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE lo_tree ADD COLUMN legacy_enrollment_matchings INT UNSIGNED NOT NULL DEFAULT 0;

-- Placement corrections by admin are audited with the old and new position.
CREATE TABLE IF NOT EXISTS lo_placement_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  old_parent_id INT UNSIGNED NULL,
  old_side ENUM('L','R') NULL,
  new_parent_id INT UNSIGNED NULL,
  new_side ENUM('L','R') NULL,
  old_sponsor_id INT UNSIGNED NULL,
  new_sponsor_id INT UNSIGNED NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (user_id)
) ENGINE=InnoDB;

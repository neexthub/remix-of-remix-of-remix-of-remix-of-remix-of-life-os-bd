-- Life OS BD merchant cashback API. Additive only; no existing balance rows are changed.
CREATE TABLE IF NOT EXISTS lo_merchant_api_keys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  status ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  KEY (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lo_merchant_cashback_debits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  debit_code VARCHAR(60) NOT NULL UNIQUE,
  merchant_key_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  life_id VARCHAR(50) NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  amount DECIMAL(14,3) NOT NULL,
  balance_after DECIMAL(14,3) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_merchant_request (merchant_key_id, request_id),
  KEY (user_id, created_at),
  KEY (merchant_key_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- New money movement stays off until the owner connects and approves the merchant app.
INSERT IGNORE INTO lo_settings (k, v) VALUES ('merchant_api_status', '0');

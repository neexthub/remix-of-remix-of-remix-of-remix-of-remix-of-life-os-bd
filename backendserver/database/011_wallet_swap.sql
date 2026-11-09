-- E wallet (withdraw wallet) -> D wallet (deposit wallet) swap. 4% charge, remainder credited to D wallet.
ALTER TABLE lo_deposits MODIFY kind ENUM('ADMIN_ADD','ACTIVATE_ID','E_SWAP') NOT NULL;

CREATE TABLE IF NOT EXISTS lo_wallet_swaps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  swap_code VARCHAR(60) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  amount DECIMAL(14,3) NOT NULL,
  charge DECIMAL(14,3) NOT NULL,
  credited DECIMAL(14,3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (user_id, created_at)
) ENGINE=InnoDB;

-- E wallet withdrawal charge is fixed at 10%.
INSERT INTO lo_settings (k, v) VALUES ('withdraw_charge_pct', '10') ON DUPLICATE KEY UPDATE v = '10';

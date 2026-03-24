CREATE DATABASE IF NOT EXISTS fortress_ledger;
USE fortress_ledger;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'CUSTOMER') DEFAULT 'CUSTOMER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    account_no VARCHAR(20) UNIQUE NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    status ENUM('ACTIVE', 'FROZEN') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_positive_balance CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    sender_id VARCHAR(36),
    receiver_id VARCHAR(36),
    amount DECIMAL(15,2) NOT NULL,
    type ENUM('TRANSFER', 'DEPOSIT', 'WITHDRAWAL') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES accounts(id),
    FOREIGN KEY (receiver_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    admin_id VARCHAR(36),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger: Audit Balance Changes
DELIMITER //
CREATE TRIGGER trg_audit_balance 
AFTER UPDATE ON accounts
FOR EACH ROW
BEGIN
    IF OLD.balance != NEW.balance THEN
        INSERT INTO audit_logs (entity_id, action, old_value, new_value)
        VALUES (NEW.id, 'BALANCE_UPDATE', OLD.balance, NEW.balance);
    END IF;
    IF OLD.status != NEW.status THEN
        INSERT INTO audit_logs (entity_id, action, old_value, new_value)
        VALUES (NEW.id, 'STATUS_UPDATE', OLD.status, NEW.status);
    END IF;
END;
//
DELIMITER ;

-- View: Global Liquidity
CREATE OR REPLACE VIEW vw_global_liquidity AS
SELECT SUM(balance) AS total_liquidity, COUNT(*) AS active_accounts 
FROM accounts WHERE status = 'ACTIVE';



-- View: Fraud Velocity (Transactions per minute over last hour)
CREATE OR REPLACE VIEW vw_fraud_velocity AS
SELECT sender_id, COUNT(*) as tx_count, SUM(amount) as total_volume 
FROM transactions 
WHERE created_at >= NOW() - INTERVAL 1 HOUR
GROUP BY sender_id
HAVING tx_count > 10 OR total_volume > 50000;
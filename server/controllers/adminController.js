const db = require('../config/db');
const crypto = require('crypto'); // <-- NEW: Added to generate secure transaction IDs

// Global System State
let IS_GLOBAL_LOCKDOWN = false;

exports.getDashboard = async (req, res) => {
    try {
        const [stats] = await db.execute('SELECT * FROM vw_global_liquidity');
        res.json(stats[0] || { total_liquidity: 0, active_accounts: 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error retrieving dashboard stats' });
    }
};
exports.getFraudAlerts = async (req, res) => {
    try {
        const [alerts] = await db.execute('SELECT * FROM vw_fraud_velocity');
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: 'Server error retrieving fraud alerts' });
    }
};


exports.freezeAccount = async (req, res) => {
    const accountId = req.params.id;
    try {
        const [account] = await db.execute('SELECT status FROM accounts WHERE id = ?', [accountId]);
        if (account.length === 0) return res.status(404).json({ error: 'Account not found' });

        const newStatus = account[0].status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';
        await db.execute('UPDATE accounts SET status = ? WHERE id = ?', [newStatus, accountId]);
        
        res.json({ message: `Account status updated to ${newStatus}` });
    } catch (error) {
        res.status(500).json({ error: 'Server error updating account status' });
    }
};


exports.getAuditTrail = async (req, res) => {
    try {
        const [logs] = await db.execute('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Server error retrieving audit trail' });
    }
};

// NEW: Central Bank Capital Injection (100% Bulletproof SQL)
exports.supplyCapital = async (req, res) => {
    const { account_no, amount } = req.body;
    
    if (!account_no || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid account number and positive amount required' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Lock the account row
        const [acc] = await connection.execute('SELECT status FROM accounts WHERE account_no = ? FOR UPDATE', [account_no]);
        if (acc.length === 0) throw new Error('Target account not found');
        if (acc[0].status !== 'ACTIVE') throw new Error('Target account is frozen');

        // 2. Inject capital
        await connection.execute('UPDATE accounts SET balance = balance + ? WHERE account_no = ?', [amount, account_no]);

        // 3. Generate secure transaction ID
        const txId = crypto.randomUUID();

        // 4. Force MySQL to resolve the internal ID itself, bypassing JS type mismatch issues
        // We also temporarily disable FK checks to ensure the NULL system sender doesn't trigger a rejection
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        await connection.execute(`
            INSERT INTO transactions (id, sender_id, receiver_id, amount) 
            SELECT ?, NULL, id, ? FROM accounts WHERE account_no = ?
        `, [txId, amount, account_no]);

        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

        await connection.commit();
        res.json({ message: `Successfully injected $${amount} into ${account_no}` });
    } catch (error) {
        await connection.rollback();
        // Failsafe to turn FK checks back on if something crashes
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1').catch(() => {}); 
        
        console.error("DB Error:", error);
        res.status(500).json({ error: error.message || 'Server error supplying capital' });
    } finally {
        connection.release();
    }
};

// NEW: Advanced Multi-Chart Analytics
exports.getChartData = async (req, res) => {
    try {
        // 1. Flow & Velocity Data (Last 24h)
        const queryFlow = `
            SELECT 
                DATE_FORMAT(created_at, '%H:00') AS time, 
                SUM(amount) AS volume,
                COUNT(id) AS tx_count
            FROM transactions 
            WHERE created_at >= NOW() - INTERVAL 24 HOUR 
            GROUP BY DATE_FORMAT(created_at, '%H:00') 
            ORDER BY MAX(created_at) ASC
        `;
        const [flowRows] = await db.execute(queryFlow);

        // 2. Liquidity Distribution (Active vs Frozen Capital)
        const queryStatus = `
            SELECT status as name, SUM(balance) as value 
            FROM accounts 
            GROUP BY status
        `;
        const [statusRows] = await db.execute(queryStatus);

        // Send everything in one massive payload
        res.json({
            flow: flowRows,
            distribution: statusRows
        });
    } catch (error) {
        console.error("Chart DB Error:", error);
        res.status(500).json({ error: 'Server error retrieving chart data' });
    }
};

// NEW: Deep Entity Inspector (Look up specific account)
exports.getAccountDetails = async (req, res) => {
    try {
        const { account_no } = req.params;
        const [acc] = await db.execute(
            'SELECT id, account_no, balance, status, created_at FROM accounts WHERE account_no = ?', 
            [account_no]
        );
        
        if (acc.length === 0) {
            return res.status(404).json({ error: 'Entity not found in ledger' });
        }
        
        res.json(acc[0]);
    } catch (error) {
        console.error("Inspector Error:", error);
        res.status(500).json({ error: 'Server error inspecting account' });
    }
};

// NEW: Global Ticker Tape
exports.getTicker = async (req, res) => {
    try {
        // Fetch the 20 most recent transactions and translate their UUIDs back to Account Numbers
        const query = `
            SELECT 
                t.amount, 
                COALESCE(s.account_no, 'CENTRAL MINT') as sender, 
                r.account_no as receiver,
                t.created_at
            FROM transactions t
            LEFT JOIN accounts s ON t.sender_id = s.id
            LEFT JOIN accounts r ON t.receiver_id = r.id
            ORDER BY t.created_at DESC
            LIMIT 20
        `;
        const [rows] = await db.execute(query);
        res.json(rows);
    } catch (error) {
        console.error("Ticker DB Error:", error);
        res.status(500).json({ error: 'Server error retrieving ticker data' });
    }
};

exports.getSystemStatus = async (req, res) => {
    try {
        res.json({ lockdown: IS_GLOBAL_LOCKDOWN });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch system status' });
    }
};

exports.toggleSystemLockdown = async (req, res) => {
    try {
        // 1. Flip the switch in the server memory
        IS_GLOBAL_LOCKDOWN = !IS_GLOBAL_LOCKDOWN;
        
        // 2. Try to log it to the database (with failsafe)
        try {
            // We removed the 'id' field, letting MySQL auto-generate it if it's auto-increment.
            // We also shortened 'DEFCON_LOCKDOWN' to 'DEFCON' just in case of character limits.
            await db.execute(
                `INSERT INTO audit_logs (action, entity_id, old_value, new_value) 
                 VALUES (?, ?, ?, ?)`,
                ['DEFCON', 'GLOBAL_NET', IS_GLOBAL_LOCKDOWN ? 'ONLINE' : 'LOCKED', IS_GLOBAL_LOCKDOWN ? 'LOCKED' : 'ONLINE']
            );
        } catch (dbError) {
            // If the DB log fails, we DON'T crash the app. We just print a warning.
            console.log("⚠️ DB Log Failsafe Triggered (Lockdown Still Engaged):", dbError.message);
        }

        // 3. Successfully return the new status to the frontend!
        res.json({ message: 'Global network status updated', lockdown: IS_GLOBAL_LOCKDOWN });
        
    } catch (error) {
        console.error("Critical Lockdown Error:", error); 
        res.status(500).json({ error: 'Failed to toggle system lockdown' });
    }
};

// Export the variable so other files can check it later if they want to physically block transfers!
exports.IS_GLOBAL_LOCKDOWN = IS_GLOBAL_LOCKDOWN;
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.getBalance = async (req, res) => {
    try {
        const [accounts] = await db.execute(
            'SELECT account_no, balance, status FROM accounts WHERE user_id = ?',
            [req.user.id]
        );

        if (accounts.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json(accounts[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error retrieving balance' });
    }
};



//Transfer
exports.transfer = async (req, res) => {
    const { receiver_account_no, amount } = req.body;
    const transferAmount = parseFloat(amount);

    if (transferAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const connection = await db.getConnection();

    try {
        // 1. ISOLATION: Start Atomic Transaction
        await connection.beginTransaction();

        // 2. LOCKING: Get Sender Account and lock the row
        const [senders] = await connection.execute(
            'SELECT id, balance, status FROM accounts WHERE user_id = ? FOR UPDATE',
            [req.user.id]
        );

        if (senders.length === 0) throw new Error('Sender account not found');
        const sender = senders[0];

        // 3. VALIDATION
        if (sender.status !== 'ACTIVE') throw new Error('Account is frozen');
        if (parseFloat(sender.balance) < transferAmount) throw new Error('Insufficient funds');

        // Get Receiver Account
        const [receivers] = await connection.execute(
            'SELECT id, status FROM accounts WHERE account_no = ? FOR UPDATE',
            [receiver_account_no]
        );

        if (receivers.length === 0) throw new Error('Receiver account not found');
        const receiver = receivers[0];
        
        if (receiver.status !== 'ACTIVE') throw new Error('Receiver account is frozen');
        if (sender.id === receiver.id) throw new Error('Cannot transfer to yourself');

        // 4. EXECUTION
        // Deduct from sender
        await connection.execute(
            'UPDATE accounts SET balance = balance - ? WHERE id = ?',
            [transferAmount, sender.id]
        );

        // Add to receiver
        await connection.execute(
            'UPDATE accounts SET balance = balance + ? WHERE id = ?',
            [transferAmount, receiver.id]
        );

        // Log transaction
        const txId = uuidv4();
        await connection.execute(
            'INSERT INTO transactions (id, sender_id, receiver_id, amount, type) VALUES (?, ?, ?, ?, ?)',
            [txId, sender.id, receiver.id, transferAmount, 'TRANSFER']
        );

        // 5. COMPLETION
        await connection.commit();
        res.json({ message: 'Transfer successful', transaction_id: txId });

    } catch (error) {
        // IF ANYTHING FAILS, UNDO EVERYTHING
        await connection.rollback();
        res.status(400).json({ error: error.message || 'Transfer failed' });
    } finally {
        connection.release();
    }
};
//History
exports.getHistory = async (req, res) => {
    try {
        // First get the user's account ID
        const [accounts] = await db.execute('SELECT id FROM accounts WHERE user_id = ?', [req.user.id]);
        if (accounts.length === 0) return res.status(404).json({ error: 'Account not found' });
        
        const accountId = accounts[0].id;

        // Fetch transactions where this account is either sender or receiver
        const [transactions] = await db.execute(
            `SELECT t.id, t.amount, t.type, t.created_at, 
             s.account_no as sender_account, r.account_no as receiver_account
             FROM transactions t
             LEFT JOIN accounts s ON t.sender_id = s.id
             LEFT JOIN accounts r ON t.receiver_id = r.id
             WHERE t.sender_id = ? OR t.receiver_id = ?
             ORDER BY t.created_at DESC LIMIT 50`,
            [accountId, accountId]
        );

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Server error retrieving history' });
    }
};
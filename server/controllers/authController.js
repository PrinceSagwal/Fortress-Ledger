const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

exports.register = async (req, res) => {
    const { email, password, role } = req.body;
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Create User
        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
        
        await connection.execute(
            'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [userId, email, hashedPassword, userRole]
        );

        // Create Default Account for Customer
        if (userRole === 'CUSTOMER') {
            const accountId = uuidv4();
            const accountNo = 'FL' + Math.floor(1000000000 + Math.random() * 9000000000).toString();
            await connection.execute(
                'INSERT INTO accounts (id, user_id, account_no, balance) VALUES (?, ?, ?, ?)',
                [accountId, userId, accountNo, 1000.00] // Giving 1000 default balance for testing
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Server error during registration' });
    } finally {
        connection.release();
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000 // 1 hour
        });

        res.json({ message: 'Logged in successfully', role: user.role });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login' });
    }
};

//Module logout 
exports.logout = (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
};
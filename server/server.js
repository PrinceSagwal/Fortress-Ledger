const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const bankingRoutes = require('./routes/bankingRoutes');
const adminRoutes = require('./routes/adminRoutes'); // NEW: Import admin routes

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/admin', adminRoutes); // NEW: Use admin routes

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'FortressLedger API' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`FortressLedger Server running on port ${PORT}`);
});
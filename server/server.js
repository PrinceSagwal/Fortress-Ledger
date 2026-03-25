const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const bankingRoutes = require('./routes/bankingRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// FIXED: Changed origin from 3000 to Vite's port 5173!
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'FortressLedger API' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`FortressLedger Server running on port ${PORT}`);
});
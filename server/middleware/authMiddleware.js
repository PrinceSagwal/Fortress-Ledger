const jwt = require('jsonwebtoken');
//Only for Admin
exports.requireAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access Denied. Admin privileges required.' });
    }
    next();
};

//Verify JWT Token
exports.verifyToken = (req, res, next) => {
    // Read the token from the HTTP-Only cookie
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ error: 'Access Denied. No token provided.' });
    }

    try {
        // Verify the token using our secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user info (id, role) to the request
        next(); // Move to the next function
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
};


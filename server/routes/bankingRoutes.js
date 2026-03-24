const express = require('express');
const router = express.Router();
const bankingController = require('../controllers/bankingController');
const { verifyToken } = require('../middleware/authMiddleware');

// All banking routes require the user to be logged in (verifyToken)
router.use(verifyToken);

router.get('/balance', bankingController.getBalance);
router.get('/history', bankingController.getHistory);
router.post('/transfer', bankingController.transfer);

module.exports = router;
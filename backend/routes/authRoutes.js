const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.adminLogin);
router.post('/verify-otp', authController.verifyAdminOtp);

module.exports = router;

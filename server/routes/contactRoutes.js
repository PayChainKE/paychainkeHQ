const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const contactController = require('../controllers/contactController');

const contactValidation = [
  body('name').isString().trim().isLength({ min: 2 }).withMessage('Please enter your full name'),
  body('email').isEmail().withMessage('Please enter a valid email address'),
  body('contactType').isIn(['merchant','investor','partnership','press','developer','careers','other']).withMessage('Please select an option'),
  body('subject').isString().trim().isLength({ min: 3 }).withMessage('Please enter a subject line'),
  body('message').isString().trim().isLength({ min: 10 }).withMessage('Please enter your message (minimum 10 characters)')
];

router.post('/', contactValidation, contactController.submitContact);

// Admin routes (protected in a real app) - simple implementations
router.get('/', contactController.getMessages);
router.patch('/:id/read', contactController.markRead);

module.exports = router;

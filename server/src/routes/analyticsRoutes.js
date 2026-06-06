const express = require('express');
const { getAnalytics } = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAnalytics);

module.exports = router;

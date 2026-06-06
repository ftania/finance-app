const express = require('express');
const {
  exportTransactionsCsv,
  generateFinancialPdf,
} = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/transactions.csv', exportTransactionsCsv);
router.get('/financial.pdf', generateFinancialPdf);

module.exports = router;

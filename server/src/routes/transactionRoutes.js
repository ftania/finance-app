const express = require('express');
const {
  createTransaction,
  getMetadata,
  getTransactions,
  updateTransactionClassification,
} = require('../controllers/transactionController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/meta', getMetadata);
router.get('/', getTransactions);
router.post('/', createTransaction);
router.patch('/:transactionId/classification', updateTransactionClassification);

module.exports = router;

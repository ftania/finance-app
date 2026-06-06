const express = require('express');
const {
  createBudgetLimit,
  deleteBudgetLimit,
  getBudgetLimits,
  updateBudgetLimit,
} = require('../controllers/budgetLimitController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getBudgetLimits);
router.post('/', createBudgetLimit);
router.patch('/:limitId', updateBudgetLimit);
router.delete('/:limitId', deleteBudgetLimit);

module.exports = router;

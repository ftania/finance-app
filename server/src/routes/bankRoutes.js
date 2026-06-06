const express = require('express');
const {
  connectMonobank,
  getAccounts,
  syncMonobank,
  updateAccountTracking,
} = require('../controllers/bankController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/accounts', getAccounts);
router.patch('/accounts/:accountId/tracking', updateAccountTracking);
router.post('/monobank/connect', connectMonobank);
router.post('/monobank/:connectionId/sync', syncMonobank);

module.exports = router;

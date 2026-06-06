const express = require('express');
const {
  changePassword,
  getCurrentUser,
  updateCurrentUser,
} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/me', getCurrentUser);
router.patch('/me', updateCurrentUser);
router.patch('/me/password', changePassword);

module.exports = router;

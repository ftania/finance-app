const bcrypt = require('bcrypt');
const { buildUserResponse, isStrongPassword } = require('./authController');
const { User } = require('../models');

const SUPPORTED_CURRENCIES = ['UAH', 'USD', 'EUR'];

const getCurrentUser = (req, res) => {
  res.json({ user: buildUserResponse(req.user) });
};

const updateCurrentUser = async (req, res, next) => {
  try {
    const { fullName, currency } = req.body;
    const errors = {};

    if (!fullName || fullName.trim().length < 2) {
      errors.fullName = 'Імʼя має містити щонайменше 2 символи';
    }

    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      errors.currency = 'Оберіть підтримувану валюту';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    req.user.fullName = fullName.trim();
    req.user.currency = currency;
    await req.user.save();

    return res.json({ user: buildUserResponse(req.user) });
  } catch (error) {
    return next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword = '', newPassword = '' } = req.body;
    const user = await User.scope('withPassword').findByPk(req.userId);

    if (!user) {
      return res.status(401).json({ message: 'Користувача не знайдено' });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!passwordMatches) {
      return res.status(400).json({ message: 'Поточний пароль неправильний' });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message:
          'Новий пароль має містити щонайменше 12 символів, велику й малу літеру, цифру та спецсимвол',
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);

    if (isSamePassword) {
      return res.status(400).json({ message: 'Новий пароль має відрізнятися від поточного' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ message: 'Пароль змінено' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  changePassword,
};

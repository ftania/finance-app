const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sequelize, User } = require('../models');
const { ensureDefaultFinanceData } = require('../services/defaultFinanceData');
const { sendPasswordResetEmail } = require('../services/emailService');

const ACCESS_TOKEN_EXPIRES_IN = '1d';
const RESET_TOKEN_EXPIRES_IN_MS = 1000 * 60 * 30;

const normalizeEmail = (email = '') => email.trim().toLowerCase();

const buildUserResponse = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  currency: user.currency,
  createdAt: user.createdAt,
});

const createToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const isStrongPassword = (password = '') =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password);

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const validateAuthPayload = ({ fullName, email, password }, mode) => {
  const errors = {};

  if (mode === 'register') {
    if (!fullName || fullName.trim().length < 2) {
      errors.fullName = 'Імʼя має містити щонайменше 2 символи';
    }
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = 'A valid email is required';
  }

  if (mode === 'register' && !isStrongPassword(password)) {
    errors.password =
      'Пароль має містити щонайменше 12 символів, велику й малу літеру, цифру та спецсимвол';
  }

  if (mode === 'login' && !password) {
    errors.password = 'Password is required';
  }

  return errors;
};

const register = async (req, res, next) => {
  try {
    const { fullName = '', email = '', password = '' } = req.body;
    const errors = validateAuthPayload({ fullName, email, password }, 'register');

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await User.scope('withPassword').findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const user = await sequelize.transaction(async (transaction) => {
      const passwordHash = await bcrypt.hash(password, 12);
      const createdUser = await User.create(
        {
          fullName: fullName.trim(),
          email: normalizedEmail,
          passwordHash,
        },
        { transaction },
      );

      await ensureDefaultFinanceData(createdUser.id, { transaction });

      return createdUser;
    });

    return res.status(201).json({
      token: createToken(user),
      user: buildUserResponse(user),
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email = '', password = '' } = req.body;
    const errors = validateAuthPayload({ email, password }, 'login');

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const user = await User.scope('withPassword').findOne({
      where: { email: normalizeEmail(email) },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({
      token: createToken(user),
      user: buildUserResponse(user),
    });
  } catch (error) {
    return next(error);
  }
};

const me = (req, res) =>
  res.json({
    user: buildUserResponse(req.user),
  });

const forgotPassword = async (req, res, next) => {
  try {
    const { email = '' } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Вкажіть коректний email' });
    }

    const user = await User.scope('withPassword').findOne({
      where: { email: normalizeEmail(email) },
    });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordTokenHash = hashResetToken(resetToken);
      user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_IN_MS);
      await user.save();

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const resetLink = `${clientUrl}/reset-password/${resetToken}`;
      await sendPasswordResetEmail({
        to: user.email,
        resetLink,
      });
    }

    return res.json({
      message: 'Якщо акаунт з таким email існує, ми надішлемо лист для відновлення пароля.',
    });
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password = '' } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          'Пароль має містити щонайменше 12 символів, велику й малу літеру, цифру та спецсимвол',
      });
    }

    const user = await User.scope('withPassword').findOne({
      where: { resetPasswordTokenHash: hashResetToken(token) },
    });

    if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Покликання недійсне або застаріле' });
    }

    const isSamePassword = await bcrypt.compare(password, user.passwordHash);

    if (isSamePassword) {
      return res.status(400).json({ message: 'Новий пароль має відрізнятися від поточного' });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.json({ message: 'Пароль оновлено' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  resetPassword,
  isStrongPassword,
  buildUserResponse,
};

const { Op } = require('sequelize');
const { Account, Transaction } = require('../models');
const { convertCurrency, normalizeCurrency } = require('./currencyService');
const { excludeInternalTransfers } = require('./transactionFilters');

const roundMoney = (amount) => Number(Number(amount || 0).toFixed(2));

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const parseDate = (value, fallback, end = false) => {
  if (!value) {
    return fallback;
  }

  const [year, month, day] = String(value).split('-').map(Number);

  if (!year || !month || !day) {
    const date = new Date(value);
    return end ? endOfDay(date) : startOfDay(date);
  }

  return new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
};

const resolvePeriodRange = (periodType, startDate, endDate) => {
  const now = new Date();

  if (periodType === 'day') {
    return {
      startDate: startOfDay(now),
      endDate: endOfDay(now),
    };
  }

  if (periodType === 'week') {
    const start = startOfDay(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    const end = endOfDay(start);
    end.setDate(start.getDate() + 6);

    return { startDate: start, endDate: end };
  }

  if (periodType === 'custom') {
    return {
      startDate: parseDate(startDate, startOfDay(now)),
      endDate: parseDate(endDate, endOfDay(now), true),
    };
  }

  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const getLimitStatus = (usedAmount, limitAmount) => {
  if (usedAmount > limitAmount) {
    return 'exceeded';
  }

  if (limitAmount > 0 && usedAmount / limitAmount >= 0.8) {
    return 'warning';
  }

  return 'safe';
};

const getActiveAccountIds = async (userId) => {
  const accounts = await Account.findAll({
    where: { userId, isTracked: true },
    attributes: ['id'],
  });

  return accounts.map((account) => account.id);
};

const getProgressForLimit = async ({ limit, user, activeAccountIds, exchangeRates }) => {
  const currency = normalizeCurrency(user.currency);
  const range = resolvePeriodRange(limit.periodType, limit.startDate, limit.endDate);
  const transactions = await Transaction.findAll({
    where: {
      userId: user.id,
      categoryId: limit.categoryId,
      type: 'expense',
      transactionDate: { [Op.gte]: range.startDate, [Op.lte]: range.endDate },
      [Op.or]: [{ accountId: null }, { accountId: activeAccountIds }],
      ...(limit.tagId ? { tagId: limit.tagId } : {}),
    },
  });
  const usedAmount = excludeInternalTransfers(transactions).reduce(
    (total, transaction) =>
      total + convertCurrency(transaction.amount, transaction.currency, currency, exchangeRates),
    0,
  );
  const limitAmount = Number(limit.limitAmount);
  const remainingAmount = limitAmount - usedAmount;
  const usedPercent = limitAmount > 0 ? Math.min((usedAmount / limitAmount) * 100, 999) : 0;

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    usedAmount: roundMoney(usedAmount),
    remainingAmount: roundMoney(remainingAmount),
    usedPercent: roundMoney(usedPercent),
    status: getLimitStatus(usedAmount, limitAmount),
  };
};

module.exports = {
  getActiveAccountIds,
  getProgressForLimit,
  resolvePeriodRange,
};

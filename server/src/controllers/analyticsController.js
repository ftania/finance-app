const { Op } = require('sequelize');
const { Account, Category, Tag, Transaction } = require('../models');
const {
  convertCurrency,
  getNbuExchangeRates,
  normalizeCurrency,
} = require('../services/currencyService');
const { ensureDefaultFinanceData } = require('../services/defaultFinanceData');
const { excludeInternalTransfers } = require('../services/transactionFilters');
const { serializeTransaction } = require('./transactionController');

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
    return end ? endOfDay(new Date(value)) : startOfDay(new Date(value));
  }

  return new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const toMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
};

const formatDayLabel = (date) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);

const formatMonthLabel = (date) =>
  new Intl.DateTimeFormat('uk-UA', {
    month: 'short',
  }).format(date);

const getPeriodRange = ({ period = 'month', dateFrom, dateTo }) => {
  const now = new Date();
  const todayEnd = endOfDay(now);

  if (period === 'custom') {
    const fallbackStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: parseDate(dateFrom, fallbackStart),
      endDate: parseDate(dateTo, todayEnd, true),
    };
  }

  if (period === 'week') {
    const startDate = startOfDay(now);
    startDate.setDate(startDate.getDate() - 6);
    return { startDate, endDate: todayEnd };
  }

  if (period === 'year') {
    return {
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: todayEnd,
    };
  }

  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: todayEnd,
  };
};

const getInclusiveDayCount = (startDate, endDate) => {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  return Math.max(Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1, 1);
};

const getGroupingMode = (period, startDate, endDate) => {
  if (period === 'year') {
    return 'month';
  }

  return getInclusiveDayCount(startDate, endDate) > 92 ? 'month' : 'day';
};

const buildTimeline = (startDate, endDate, groupingMode) => {
  const timeline = new Map();
  const cursor = startOfDay(startDate);

  if (groupingMode === 'month') {
    cursor.setDate(1);

    while (cursor <= endDate) {
      timeline.set(toMonthKey(cursor), {
        key: toMonthKey(cursor),
        label: formatMonthLabel(cursor),
        income: 0,
        expense: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return timeline;
  }

  while (cursor <= endDate) {
    timeline.set(toDateKey(cursor), {
      key: toDateKey(cursor),
      label: formatDayLabel(cursor),
      income: 0,
      expense: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return timeline;
};

const addToGroupedAmount = (group, key, amount) => {
  group[key] = (group[key] || 0) + amount;
};

const serializeAnalyticsTransaction = (transaction, convertAmount, analyticsCurrency) => {
  const serialized = serializeTransaction(transaction);

  return {
    ...serialized,
    originalAmount: serialized.amount,
    originalCurrency: serialized.currency,
    amount: convertAmount(transaction),
    currency: analyticsCurrency,
    wasConverted: serialized.currency !== analyticsCurrency,
  };
};

const summarizeTransactions = (transactions, convertAmount) =>
  transactions.reduce(
    (result, transaction) => {
      const amount = convertAmount(transaction);

      if (transaction.type === 'income') {
        result.income += amount;
      } else {
        result.expense += amount;
      }

      return result;
    },
    { income: 0, expense: 0 },
  );

const getAnalytics = async (req, res, next) => {
  try {
    await ensureDefaultFinanceData(req.userId);

    const period = ['week', 'month', 'year', 'custom'].includes(req.query.period)
      ? req.query.period
      : 'month';
    const { startDate, endDate } = getPeriodRange({
      period,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });
    const analyticsCurrency = normalizeCurrency(req.user.currency);
    const exchangeRates = await getNbuExchangeRates();
    const convertAmount = (transaction) =>
      convertCurrency(
        transaction.amount,
        transaction.currency,
        analyticsCurrency,
        exchangeRates,
      );

    const activeAccounts = await Account.findAll({
      where: { userId: req.userId, isTracked: true },
      attributes: ['id'],
    });
    const tags = await Tag.findAll({
      where: { userId: req.userId },
      attributes: ['name'],
      order: [['name', 'ASC']],
    });
    const activeAccountIds = activeAccounts.map((account) => account.id);
    const accountScope = {
      [Op.or]: [{ accountId: null }, { accountId: activeAccountIds }],
    };

    const transactions = await Transaction.findAll({
      where: {
        userId: req.userId,
        transactionDate: { [Op.gte]: startDate, [Op.lte]: endDate },
        ...accountScope,
      },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
        { model: Tag, as: 'tag', attributes: ['id', 'name'] },
        { model: Account, as: 'account', attributes: ['id', 'name', 'isTracked'] },
      ],
      order: [['transactionDate', 'ASC']],
    });

    const analyticalTransactions = excludeInternalTransfers(transactions);
    const summary = summarizeTransactions(analyticalTransactions, convertAmount);
    const expensesByCategory = {};
    const expensesByTag = {};

    analyticalTransactions
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        const amount = convertAmount(transaction);
        addToGroupedAmount(expensesByCategory, transaction.category?.name || 'Інше', amount);
        addToGroupedAmount(expensesByTag, transaction.tag?.name || 'Інше', amount);
      });

    const groupingMode = getGroupingMode(period, startDate, endDate);
    const timeline = buildTimeline(startDate, endDate, groupingMode);
    analyticalTransactions.forEach((transaction) => {
      const date = transaction.transactionDate;
      const key = groupingMode === 'month' ? toMonthKey(date) : toDateKey(date);
      const item = timeline.get(key);

      if (!item) {
        return;
      }

      item[transaction.type] += convertAmount(transaction);
    });

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    const comparisonTransactions = await Transaction.findAll({
      where: {
        userId: req.userId,
        transactionDate: { [Op.gte]: previousMonthStart, [Op.lte]: endOfDay(now) },
        ...accountScope,
      },
    });
    const comparisonAnalyticalTransactions = excludeInternalTransfers(comparisonTransactions);
    const currentMonthSummary = summarizeTransactions(
      comparisonAnalyticalTransactions.filter(
        (transaction) => transaction.transactionDate >= currentMonthStart,
      ),
      convertAmount,
    );
    const previousMonthSummary = summarizeTransactions(
      comparisonAnalyticalTransactions.filter(
        (transaction) =>
          transaction.transactionDate >= previousMonthStart &&
          transaction.transactionDate <= previousMonthEnd,
      ),
      convertAmount,
    );

    const topExpenses = analyticalTransactions
      .filter((transaction) => transaction.type === 'expense')
      .sort((first, second) => convertAmount(second) - convertAmount(first))
      .slice(0, 6)
      .map((transaction) =>
        serializeAnalyticsTransaction(transaction, convertAmount, analyticsCurrency),
      );

    return res.json({
      period,
      dateFrom: startDate,
      dateTo: endDate,
      currency: analyticsCurrency,
      exchangeRateDate: exchangeRates.rateDate,
      activeAccountsCount: activeAccounts.length,
      totalIncome: roundMoney(summary.income),
      totalExpense: roundMoney(summary.expense),
      financialResult: roundMoney(summary.income - summary.expense),
      averageDailyExpense: roundMoney(summary.expense / getInclusiveDayCount(startDate, endDate)),
      expensesByCategory: Object.entries(expensesByCategory)
        .map(([name, amount]) => ({ name, amount: roundMoney(amount) }))
        .sort((first, second) => second.amount - first.amount),
      expensesByTag: Object.entries(expensesByTag)
        .concat(tags.map((tag) => [tag.name, expensesByTag[tag.name] || 0]))
        .reduce((items, [name, amount]) => {
          if (items.some((item) => item.name === name)) {
            return items;
          }

          return [...items, { name, amount: roundMoney(amount) }];
        }, [])
        .sort((first, second) => second.amount - first.amount),
      topExpenses,
      cashflow: Array.from(timeline.values()).map((item) => ({
        ...item,
        income: roundMoney(item.income),
        expense: roundMoney(item.expense),
      })),
      monthComparison: {
        current: {
          income: roundMoney(currentMonthSummary.income),
          expense: roundMoney(currentMonthSummary.expense),
          result: roundMoney(currentMonthSummary.income - currentMonthSummary.expense),
        },
        previous: {
          income: roundMoney(previousMonthSummary.income),
          expense: roundMoney(previousMonthSummary.expense),
          result: roundMoney(previousMonthSummary.income - previousMonthSummary.expense),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAnalytics,
};

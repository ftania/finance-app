const { Op } = require('sequelize');
const { Account, BudgetLimit, Category, Tag, Transaction } = require('../models');
const { ensureDefaultFinanceData } = require('../services/defaultFinanceData');
const {
  convertCurrency,
  getNbuExchangeRates,
  normalizeCurrency,
} = require('../services/currencyService');
const {
  getActiveAccountIds,
  getProgressForLimit,
} = require('../services/budgetLimitProgress');
const { serializeTransaction } = require('./transactionController');
const { excludeInternalTransfers } = require('../services/transactionFilters');

const sumTransactions = (transactions, type, convertAmount) =>
  transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + convertAmount(transaction), 0);

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

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const serializeDashboardTransaction = (transaction, convertAmount, dashboardCurrency) => {
  const serializedTransaction = serializeTransaction(transaction);
  const convertedAmount = convertAmount(transaction);

  return {
    ...serializedTransaction,
    originalAmount: serializedTransaction.amount,
    originalCurrency: serializedTransaction.currency,
    amount: convertedAmount,
    currency: dashboardCurrency,
    wasConverted: serializedTransaction.currency !== dashboardCurrency,
  };
};

const getDashboard = async (req, res, next) => {
  try {
    await ensureDefaultFinanceData(req.userId);

    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const chartStart = startOfDay(now);
    chartStart.setDate(chartStart.getDate() - 6);
    const dashboardCurrency = normalizeCurrency(req.user.currency);
    const exchangeRates = await getNbuExchangeRates();
    const convertAmount = (transaction) =>
      convertCurrency(
        transaction.amount,
        transaction.currency,
        dashboardCurrency,
        exchangeRates,
      );

    const trackedAccounts = await Account.findAll({
      where: { userId: req.userId, isTracked: true },
      attributes: ['id', 'balance', 'currency'],
    });
    const trackedAccountIds = trackedAccounts.map((account) => account.id);
    const trackedTransactionScope = {
      [Op.or]: [{ accountId: null }, { accountId: trackedAccountIds }],
    };

    const [monthTransactions, recentTransactions, chartTransactions, activeBudgetLimits] =
      await Promise.all([
        Transaction.findAll({
          where: {
            userId: req.userId,
            transactionDate: { [Op.gte]: monthStart, [Op.lte]: now },
            ...trackedTransactionScope,
          },
          include: [
            { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
          ],
        }),
        Transaction.findAll({
          where: { userId: req.userId, ...trackedTransactionScope },
          include: [
            { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
            { model: Tag, as: 'tag', attributes: ['id', 'name'] },
            { model: Account, as: 'account', attributes: ['id', 'name', 'isTracked'] },
          ],
          order: [['transactionDate', 'DESC']],
          limit: 5,
        }),
        Transaction.findAll({
          where: {
            userId: req.userId,
            transactionDate: { [Op.gte]: chartStart, [Op.lte]: endOfDay(now) },
            ...trackedTransactionScope,
          },
        }),
        BudgetLimit.findAll({
          where: {
            userId: req.userId,
            isActive: true,
          },
        }),
      ]);
    const activeBudgetAccountIds = await getActiveAccountIds(req.userId);
    const budgetLimitProgress = await Promise.all(
      activeBudgetLimits.map((limit) =>
        getProgressForLimit({
          limit,
          user: req.user,
          activeAccountIds: activeBudgetAccountIds,
          exchangeRates,
        }),
      ),
    );

    const analyticalMonthTransactions = excludeInternalTransfers(monthTransactions);
    const analyticalChartTransactions = excludeInternalTransfers(chartTransactions);
    const todayTransactions = analyticalMonthTransactions.filter(
      (transaction) => transaction.transactionDate >= todayStart,
    );
    const monthlyIncome = sumTransactions(analyticalMonthTransactions, 'income', convertAmount);
    const monthlyExpense = sumTransactions(analyticalMonthTransactions, 'expense', convertAmount);
    const totalBalance = trackedAccounts.reduce(
      (total, account) =>
        total +
        convertCurrency(account.balance, account.currency, dashboardCurrency, exchangeRates),
      0,
    );

    const expensesByCategory = analyticalMonthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((result, transaction) => {
        const categoryName = transaction.category?.name || 'Інше';
        result[categoryName] = (result[categoryName] || 0) + convertAmount(transaction);
        return result;
      }, {});

    const chartMap = new Map();
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(chartStart);
      date.setDate(chartStart.getDate() + index);
      chartMap.set(toDateKey(date), {
        date: toDateKey(date),
        label: new Intl.DateTimeFormat('uk-UA', {
          day: '2-digit',
          month: '2-digit',
        }).format(date),
        income: 0,
        expense: 0,
      });
    }

    analyticalChartTransactions.forEach((transaction) => {
      const key = toDateKey(transaction.transactionDate);
      const day = chartMap.get(key);

      if (!day) {
        return;
      }

      if (transaction.type === 'income') {
        day.income += convertAmount(transaction);
      } else {
        day.expense += convertAmount(transaction);
      }
    });

    return res.json({
      currentDate: now,
      currency: dashboardCurrency,
      exchangeRateDate: exchangeRates.rateDate,
      activeAccountsCount: trackedAccounts.length,
      totalBalance: roundMoney(totalBalance),
      todayIncome: roundMoney(sumTransactions(todayTransactions, 'income', convertAmount)),
      todayExpense: roundMoney(sumTransactions(todayTransactions, 'expense', convertAmount)),
      monthlyIncome: roundMoney(monthlyIncome),
      monthlyExpense: roundMoney(monthlyExpense),
      monthlyResult: roundMoney(monthlyIncome - monthlyExpense),
      budgetLimitsTotal: activeBudgetLimits.length,
      budgetLimitsExceeded: budgetLimitProgress.filter(
        (progress) => progress.status === 'exceeded',
      ).length,
      recentTransactions: recentTransactions.map((transaction) =>
        serializeDashboardTransaction(transaction, convertAmount, dashboardCurrency),
      ),
      expensesByCategory: Object.entries(expensesByCategory)
        .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
        .sort((first, second) => second.amount - first.amount)
        .slice(0, 6),
      cashflowByDay: Array.from(chartMap.values()).map((day) => ({
        ...day,
        income: Number(day.income.toFixed(2)),
        expense: Number(day.expense.toFixed(2)),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
};

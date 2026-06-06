const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const { Account, BudgetLimit, Category, Tag, Transaction } = require('../models');
const {
  convertCurrency,
  getNbuExchangeRates,
  normalizeCurrency,
} = require('../services/currencyService');
const {
  getActiveAccountIds,
  getProgressForLimit,
} = require('../services/budgetLimitProgress');
const { excludeInternalTransfers } = require('../services/transactionFilters');

const FONT_REGULAR = path.join(__dirname, '../assets/fonts/Inter-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '../assets/fonts/Inter-Bold.ttf');

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

const getPeriodRange = ({ period = 'month', dateFrom, dateTo }) => {
  const now = new Date();
  const todayEnd = endOfDay(now);

  if (period === 'today') {
    return { startDate: startOfDay(now), endDate: endOfDay(now), label: 'Сьогодні' };
  }

  if (period === 'week') {
    const startDate = startOfDay(now);
    startDate.setDate(startDate.getDate() - 6);
    return { startDate, endDate: endOfDay(now), label: 'Останні 7 днів' };
  }

  if (period === 'year') {
    return {
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: endOfDay(now),
      label: 'Поточний рік',
    };
  }

  if (period === 'custom') {
    if (!dateFrom || !dateTo) {
      const error = new Error('Оберіть дату початку і завершення');
      error.statusCode = 400;
      throw error;
    }

    const startDate = parseDate(dateFrom, new Date(now.getFullYear(), now.getMonth(), 1));
    const endDate = parseDate(dateTo, todayEnd, true);

    if (startDate > todayEnd || endDate > todayEnd) {
      const error = new Error('Не можна обрати дату з майбутнього');
      error.statusCode = 400;
      throw error;
    }

    if (startDate > endDate) {
      const error = new Error('Дата початку не може бути пізніше дати завершення');
      error.statusCode = 400;
      throw error;
    }

    return {
      startDate,
      endDate,
      label: `${formatDate(startDate)} - ${formatDate(endDate)}`,
    };
  }

  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: endOfDay(now),
    label: 'Поточний місяць',
  };
};

const formatDate = (date) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));

const formatMoney = (amount, currency = 'UAH') =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
  }).format(Number(amount || 0));

const getFilteredTransactions = async (req, range) => {
  const activeAccounts = await Account.findAll({
    where: { userId: req.userId, isTracked: true },
    attributes: ['id'],
  });
  const activeAccountIds = activeAccounts.map((account) => account.id);
  const where = {
    userId: req.userId,
    transactionDate: { [Op.gte]: range.startDate, [Op.lte]: range.endDate },
    [Op.or]: [{ accountId: null }, { accountId: activeAccountIds }],
  };

  if (req.query.accountId) {
    const account = await Account.findOne({
      where: { id: req.query.accountId, userId: req.userId, isTracked: true },
    });

    if (!account) {
      const error = new Error('Активний рахунок не знайдено');
      error.statusCode = 404;
      throw error;
    }

    where.accountId = account.id;
    delete where[Op.or];
  }

  if (['income', 'expense'].includes(req.query.type)) {
    where.type = req.query.type;
  }

  if (req.query.categoryId) {
    const category = await Category.findOne({
      where: { id: req.query.categoryId, userId: req.userId },
    });

    if (!category) {
      const error = new Error('Категорію не знайдено');
      error.statusCode = 404;
      throw error;
    }

    where.categoryId = category.id;
  }

  if (req.query.tagId) {
    const tag = await Tag.findOne({
      where: { id: req.query.tagId, userId: req.userId },
    });

    if (!tag) {
      const error = new Error('Тег не знайдено');
      error.statusCode = 404;
      throw error;
    }

    where.tagId = tag.id;
  }

  return Transaction.findAll({
    where,
    include: [
      { model: Account, as: 'account', attributes: ['id', 'name', 'currency'] },
      { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
      { model: Tag, as: 'tag', attributes: ['id', 'name'] },
    ],
    order: [['transactionDate', 'DESC']],
  });
};

const escapeCsv = (value) => {
  const text = String(value ?? '');
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const buildCsv = (transactions) => {
  const rows = [
    ['Дата', 'Тип', 'Сума', 'Валюта', 'Рахунок', 'Категорія', 'Тег', 'Опис', 'Джерело'],
    ...transactions.map((transaction) => [
      formatDate(transaction.transactionDate),
      transaction.type === 'income' ? 'Дохід' : 'Витрата',
      Number(transaction.amount),
      transaction.currency,
      transaction.account?.name || 'Без рахунку',
      transaction.category?.name || 'Інше',
      transaction.tag?.name || 'Інше',
      transaction.description,
      transaction.source === 'monobank' ? 'Monobank' : 'Вручну',
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(';')).join('\n')}`;
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

const groupExpenses = (transactions, convertAmount, getter) =>
  transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((result, transaction) => {
      const key = getter(transaction) || 'Інше';
      result[key] = (result[key] || 0) + convertAmount(transaction);
      return result;
    }, {});

const toSortedRows = (group) =>
  Object.entries(group)
    .map(([name, amount]) => ({ name, amount: roundMoney(amount) }))
    .sort((first, second) => second.amount - first.amount);

const addSectionTitle = (doc, title) => {
  doc.moveDown(1.1).font('Bold').fontSize(15).fillColor('#0F172A').text(title);
  doc.moveDown(0.3);
};

const addKeyValue = (doc, label, value) => {
  doc.font('Bold').fontSize(10).fillColor('#64748B').text(label, { continued: true });
  doc.font('Regular').fillColor('#0F172A').text(` ${value}`);
};

const addRows = (doc, rows, currency) => {
  if (!rows.length) {
    doc.font('Regular').fontSize(10).fillColor('#64748B').text('Даних немає');
    return;
  }

  rows.forEach((row) => {
    doc
      .font('Regular')
      .fontSize(10)
      .fillColor('#0F172A')
      .text(`${row.name}: ${formatMoney(row.amount, currency)}`);
  });
};

const getLimitRows = async ({ req, exchangeRates }) => {
  const limits = await BudgetLimit.findAll({
    where: { userId: req.userId, isActive: true },
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
      { model: Tag, as: 'tag', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', 'DESC']],
  });
  const activeAccountIds = await getActiveAccountIds(req.userId);

  return Promise.all(
    limits.map(async (limit) => {
      const progress = await getProgressForLimit({
        limit,
        user: req.user,
        activeAccountIds,
        exchangeRates,
      });

      return {
        name: `${limit.category?.name || 'Категорія'}${limit.tag?.name ? ` · ${limit.tag.name}` : ''}`,
        status: progress.status,
        usedAmount: progress.usedAmount,
        limitAmount: Number(limit.limitAmount),
      };
    }),
  );
};

const exportTransactionsCsv = async (req, res, next) => {
  try {
    const range = getPeriodRange(req.query);
    const transactions = await getFilteredTransactions(req, range);
    const csv = buildCsv(transactions);
    const fileName = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
};

const generateFinancialPdf = async (req, res, next) => {
  try {
    const range = getPeriodRange(req.query);
    const transactions = await getFilteredTransactions(req, range);
    const reportTransactions = excludeInternalTransfers(transactions);
    const reportCurrency = normalizeCurrency(req.user.currency);
    const exchangeRates = await getNbuExchangeRates();
    const convertAmount = (transaction) =>
      convertCurrency(transaction.amount, transaction.currency, reportCurrency, exchangeRates);
    const summary = summarizeTransactions(reportTransactions, convertAmount);
    const categories = toSortedRows(
      groupExpenses(reportTransactions, convertAmount, (transaction) => transaction.category?.name),
    );
    const tags = toSortedRows(
      groupExpenses(reportTransactions, convertAmount, (transaction) => transaction.tag?.name),
    );
    const topExpenses = reportTransactions
      .filter((transaction) => transaction.type === 'expense')
      .sort((first, second) => convertAmount(second) - convertAmount(first))
      .slice(0, 8)
      .map((transaction) => ({
        name: `${formatDate(transaction.transactionDate)} · ${transaction.description}`,
        amount: roundMoney(convertAmount(transaction)),
      }));
    const limitRows = await getLimitRows({ req, exchangeRates });
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const fileName = `financial-report-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    doc.registerFont('Regular', FONT_REGULAR);
    doc.registerFont('Bold', fs.existsSync(FONT_BOLD) ? FONT_BOLD : FONT_REGULAR);

    doc.font('Bold').fontSize(24).fillColor('#0F172A').text('Фінансовий звіт');
    doc.moveDown(0.5);
    addKeyValue(doc, 'Користувач:', `${req.user.fullName} · ${req.user.email}`);
    addKeyValue(doc, 'Дата формування:', formatDate(new Date()));
    addKeyValue(doc, 'Період:', range.label);

    addSectionTitle(doc, 'Підсумок');
    addKeyValue(doc, 'Загальні доходи:', formatMoney(summary.income, reportCurrency));
    addKeyValue(doc, 'Загальні витрати:', formatMoney(summary.expense, reportCurrency));
    addKeyValue(doc, 'Фінансовий результат:', formatMoney(summary.income - summary.expense, reportCurrency));

    addSectionTitle(doc, 'Витрати за категоріями');
    addRows(doc, categories, reportCurrency);

    addSectionTitle(doc, 'Витрати за тегами');
    addRows(doc, tags, reportCurrency);

    addSectionTitle(doc, 'Топ найбільших витрат');
    addRows(doc, topExpenses, reportCurrency);

    addSectionTitle(doc, 'Стан бюджетних лімітів');
    if (!limitRows.length) {
      doc.font('Regular').fontSize(10).fillColor('#64748B').text('Активних лімітів немає');
    } else {
      limitRows.forEach((limit) => {
        const statusLabel = {
          safe: 'У нормі',
          warning: 'Понад 80%',
          exceeded: 'Перевищено',
        }[limit.status];
        doc
          .font('Regular')
          .fontSize(10)
          .fillColor('#0F172A')
          .text(
            `${limit.name}: ${formatMoney(limit.usedAmount, reportCurrency)} з ${formatMoney(limit.limitAmount, reportCurrency)} · ${statusLabel}`,
          );
      });
    }

    doc.end();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  exportTransactionsCsv,
  generateFinancialPdf,
};

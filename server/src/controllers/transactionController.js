const { Op } = require('sequelize');
const { Account, Category, Tag, Transaction } = require('../models');
const {
  ensureDefaultFinanceData,
  getFallbackCategory,
  getFallbackTag,
} = require('../services/defaultFinanceData');

const parseDateStart = (dateValue) => {
  const [year, month, day] = String(dateValue).split('-').map(Number);

  if (!year || !month || !day) {
    return new Date(dateValue);
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const parseDateEnd = (dateValue) => {
  const [year, month, day] = String(dateValue).split('-').map(Number);

  if (!year || !month || !day) {
    const date = new Date(dateValue);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  return new Date(year, month - 1, day, 23, 59, 59, 999);
};

const getPeriodRange = (period, dateFrom, dateTo) => {
  if (dateFrom || dateTo) {
    return {
      ...(dateFrom ? { [Op.gte]: parseDateStart(dateFrom) } : {}),
      ...(dateTo ? { [Op.lte]: parseDateEnd(dateTo) } : {}),
    };
  }

  const now = new Date();
  const start = new Date(now);

  if (period === 'week') {
    start.setDate(now.getDate() - 6);
  } else if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
  }

  return {
    [Op.gte]: start,
    [Op.lte]: now,
  };
};

const serializeTransaction = (transaction) => ({
  id: transaction.id,
  accountId: transaction.accountId,
  accountName: transaction.account?.name,
  amount: Number(transaction.amount),
  currency: transaction.currency,
  type: transaction.type,
  description: transaction.description,
  transactionDate: transaction.transactionDate,
  source: transaction.source,
  externalTransactionId: transaction.externalTransactionId,
  categoryId: transaction.categoryId,
  categoryName: transaction.category?.name,
  tagId: transaction.tagId,
  tagName: transaction.tag?.name,
  status: transaction.status,
});

const getMetadata = async (req, res, next) => {
  try {
    await ensureDefaultFinanceData(req.userId);

    const [categories, tags, accounts] = await Promise.all([
      Category.findAll({
        where: { userId: req.userId },
        order: [
          ['type', 'ASC'],
          ['name', 'ASC'],
        ],
      }),
      Tag.findAll({
        where: { userId: req.userId },
        order: [['name', 'ASC']],
      }),
      Account.findAll({
        where: { userId: req.userId },
        order: [['createdAt', 'ASC']],
      }),
    ]);

    return res.json({
      categories,
      tags,
      accounts,
    });
  } catch (error) {
    return next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    await ensureDefaultFinanceData(req.userId);

    const {
      period = 'month',
      type,
      categoryId,
      tagId,
      search = '',
      dateFrom,
      dateTo,
    } = req.query;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 5), 50);
    const offset = (page - 1) * limit;

    const where = {
      userId: req.userId,
      transactionDate: getPeriodRange(period, dateFrom, dateTo),
    };
    const trackedAccounts = await Account.findAll({
      where: { userId: req.userId, isTracked: true },
      attributes: ['id'],
    });
    const trackedAccountIds = trackedAccounts.map((account) => account.id);

    where[Op.or] = [{ accountId: null }, { accountId: trackedAccountIds }];

    if (type && ['income', 'expense'].includes(type)) {
      where.type = type;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tagId) {
      where.tagId = tagId;
    }

    if (search.trim()) {
      where.description = {
        [Op.iLike]: `%${search.trim()}%`,
      };
    }

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
        { model: Tag, as: 'tag', attributes: ['id', 'name'] },
        {
          model: Account,
          as: 'account',
          attributes: ['id', 'name', 'isTracked'],
          required: false,
        },
      ],
      order: [['transactionDate', 'DESC']],
      distinct: true,
      limit,
      offset,
    });

    return res.json({
      transactions: rows.map(serializeTransaction),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.max(Math.ceil(count / limit), 1),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    await ensureDefaultFinanceData(req.userId);

    const {
      accountId = null,
      amount,
      currency = req.user.currency || 'UAH',
      type,
      description = '',
      transactionDate,
      categoryId,
      tagId,
    } = req.body;

    if (!Number(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Сума має бути більшою за 0' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Оберіть тип операції' });
    }

    if (accountId) {
      const account = await Account.findOne({
        where: { id: accountId, userId: req.userId },
      });

      if (!account) {
        return res.status(404).json({ message: 'Рахунок не знайдено' });
      }
    }

    const fallbackCategory = await getFallbackCategory(req.userId, type);
    const fallbackTag = await getFallbackTag(req.userId);

    const category = categoryId
      ? await Category.findOne({ where: { id: categoryId, userId: req.userId, type } })
      : fallbackCategory;
    const tag = tagId
      ? await Tag.findOne({ where: { id: tagId, userId: req.userId } })
      : fallbackTag;

    const transaction = await Transaction.create({
      userId: req.userId,
      accountId,
      amount: Number(amount).toFixed(2),
      currency,
      type,
      description: description.trim() || 'Ручна операція',
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      source: 'manual',
      categoryId: category?.id || fallbackCategory.id,
      tagId: tag?.id || fallbackTag.id,
      status: category && tag ? 'confirmed' : 'needs_review',
    });

    const createdTransaction = await Transaction.findByPk(transaction.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
        { model: Tag, as: 'tag', attributes: ['id', 'name'] },
        { model: Account, as: 'account', attributes: ['id', 'name', 'isTracked'] },
      ],
    });

    return res.status(201).json({
      transaction: serializeTransaction(createdTransaction),
      message: 'Транзакцію додано',
    });
  } catch (error) {
    return next(error);
  }
};

const updateTransactionClassification = async (req, res, next) => {
  try {
    const { categoryId, tagId } = req.body;
    const transaction = await Transaction.findOne({
      where: {
        id: req.params.transactionId,
        userId: req.userId,
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Транзакцію не знайдено' });
    }

    const category = await Category.findOne({
      where: {
        id: categoryId,
        userId: req.userId,
        type: transaction.type,
      },
    });
    const tag = await Tag.findOne({
      where: {
        id: tagId,
        userId: req.userId,
      },
    });

    if (!category || !tag) {
      return res.status(400).json({ message: 'Оберіть коректну категорію і тег' });
    }

    transaction.categoryId = category.id;
    transaction.tagId = tag.id;
    transaction.status = 'confirmed';
    await transaction.save();

    const updatedTransaction = await Transaction.findByPk(transaction.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
        { model: Tag, as: 'tag', attributes: ['id', 'name'] },
        { model: Account, as: 'account', attributes: ['id', 'name', 'isTracked'] },
      ],
    });

    return res.json({
      transaction: serializeTransaction(updatedTransaction),
      message: 'Транзакцію оновлено',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createTransaction,
  getMetadata,
  getTransactions,
  serializeTransaction,
  updateTransactionClassification,
};

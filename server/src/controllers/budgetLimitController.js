const { BudgetLimit, Category, Tag } = require('../models');
const { getNbuExchangeRates, normalizeCurrency } = require('../services/currencyService');
const {
  getActiveAccountIds,
  getProgressForLimit,
  resolvePeriodRange,
} = require('../services/budgetLimitProgress');
const { ensureDefaultFinanceData } = require('../services/defaultFinanceData');

const SUPPORTED_PERIODS = ['day', 'week', 'month', 'custom'];

const serializeLimit = async ({ limit, user, activeAccountIds, exchangeRates }) => {
  const progress = await getProgressForLimit({
    limit,
    user,
    activeAccountIds,
    exchangeRates,
  });

  return {
    id: limit.id,
    categoryId: limit.categoryId,
    categoryName: limit.category?.name,
    tagId: limit.tagId,
    tagName: limit.tag?.name,
    limitAmount: Number(limit.limitAmount),
    periodType: limit.periodType,
    startDate: progress.startDate,
    endDate: progress.endDate,
    isActive: limit.isActive,
    currency: normalizeCurrency(user.currency),
    ...progress,
  };
};

const getLimitPayload = (body) => {
  const periodType = SUPPORTED_PERIODS.includes(body.periodType)
    ? body.periodType
    : 'month';
  const range = resolvePeriodRange(periodType, body.startDate, body.endDate);

  return {
    categoryId: body.categoryId,
    tagId: body.tagId || null,
    limitAmount: Number(body.limitAmount),
    periodType,
    startDate: range.startDate,
    endDate: range.endDate,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
};

const validateLimitPayload = async (req, payload) => {
  if (!Number(payload.limitAmount) || Number(payload.limitAmount) <= 0) {
    return 'Сума ліміту має бути більшою за 0';
  }

  const category = await Category.findOne({
    where: {
      id: payload.categoryId,
      userId: req.userId,
      type: 'expense',
    },
  });

  if (!category) {
    return 'Оберіть категорію витрат';
  }

  if (payload.tagId) {
    const tag = await Tag.findOne({
      where: {
        id: payload.tagId,
        userId: req.userId,
      },
    });

    if (!tag) {
      return 'Оберіть коректний тег';
    }
  }

  if (payload.startDate > payload.endDate) {
    return 'Дата початку не може бути пізніше дати завершення';
  }

  return null;
};

const getBudgetLimits = async (req, res, next) => {
  try {
    await ensureDefaultFinanceData(req.userId);

    const [limits, activeAccountIds, exchangeRates] = await Promise.all([
      BudgetLimit.findAll({
        where: { userId: req.userId },
        include: [
          { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
          { model: Tag, as: 'tag', attributes: ['id', 'name'] },
        ],
        order: [
          ['isActive', 'DESC'],
          ['createdAt', 'DESC'],
        ],
      }),
      getActiveAccountIds(req.userId),
      getNbuExchangeRates(),
    ]);

    const serializedLimits = await Promise.all(
      limits.map((limit) =>
        serializeLimit({
          limit,
          user: req.user,
          activeAccountIds,
          exchangeRates,
        }),
      ),
    );

    return res.json({ limits: serializedLimits });
  } catch (error) {
    return next(error);
  }
};

const createBudgetLimit = async (req, res, next) => {
  try {
    const payload = getLimitPayload(req.body);
    const validationError = await validateLimitPayload(req, payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const limit = await BudgetLimit.create({
      userId: req.userId,
      ...payload,
    });
    const createdLimit = await BudgetLimit.findByPk(limit.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
        { model: Tag, as: 'tag', attributes: ['id', 'name'] },
      ],
    });
    const [activeAccountIds, exchangeRates] = await Promise.all([
      getActiveAccountIds(req.userId),
      getNbuExchangeRates(),
    ]);

    return res.status(201).json({
      limit: await serializeLimit({
        limit: createdLimit,
        user: req.user,
        activeAccountIds,
        exchangeRates,
      }),
      message: 'Ліміт створено',
    });
  } catch (error) {
    return next(error);
  }
};

const updateBudgetLimit = async (req, res, next) => {
  try {
    const limit = await BudgetLimit.findOne({
      where: { id: req.params.limitId, userId: req.userId },
    });

    if (!limit) {
      return res.status(404).json({ message: 'Ліміт не знайдено' });
    }

    const payload = getLimitPayload({
      categoryId: req.body.categoryId ?? limit.categoryId,
      tagId: req.body.tagId === undefined ? limit.tagId : req.body.tagId,
      limitAmount: req.body.limitAmount ?? limit.limitAmount,
      periodType: req.body.periodType ?? limit.periodType,
      startDate: req.body.startDate ?? limit.startDate,
      endDate: req.body.endDate ?? limit.endDate,
      isActive: req.body.isActive === undefined ? limit.isActive : req.body.isActive,
    });
    const validationError = await validateLimitPayload(req, payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await limit.update(payload);

    const updatedLimit = await BudgetLimit.findByPk(limit.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
        { model: Tag, as: 'tag', attributes: ['id', 'name'] },
      ],
    });
    const [activeAccountIds, exchangeRates] = await Promise.all([
      getActiveAccountIds(req.userId),
      getNbuExchangeRates(),
    ]);

    return res.json({
      limit: await serializeLimit({
        limit: updatedLimit,
        user: req.user,
        activeAccountIds,
        exchangeRates,
      }),
      message: 'Ліміт оновлено',
    });
  } catch (error) {
    return next(error);
  }
};

const deleteBudgetLimit = async (req, res, next) => {
  try {
    const deletedCount = await BudgetLimit.destroy({
      where: { id: req.params.limitId, userId: req.userId },
    });

    if (!deletedCount) {
      return res.status(404).json({ message: 'Ліміт не знайдено' });
    }

    return res.json({ message: 'Ліміт видалено' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createBudgetLimit,
  deleteBudgetLimit,
  getBudgetLimits,
  updateBudgetLimit,
};

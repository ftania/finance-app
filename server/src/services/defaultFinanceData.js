const { Category, Tag } = require('../models');

const defaultCategories = [
  { name: 'Зарплата', type: 'income' },
  { name: 'Перекази', type: 'income' },
  { name: 'Подарунки', type: 'income' },
  { name: 'Інше', type: 'income' },
  { name: 'Продукти', type: 'expense' },
  { name: 'Транспорт', type: 'expense' },
  { name: 'Дім', type: 'expense' },
  { name: 'Здоровʼя', type: 'expense' },
  { name: 'Розваги', type: 'expense' },
  { name: 'Кафе', type: 'expense' },
  { name: 'Покупки', type: 'expense' },
  { name: 'Комунальні', type: 'expense' },
  { name: 'Освіта', type: 'expense' },
  { name: 'Подорожі', type: 'expense' },
  { name: 'Підписки', type: 'expense' },
  { name: 'Звʼязок', type: 'expense' },
  { name: 'Послуги', type: 'expense' },
  { name: 'Інше', type: 'expense' },
];

const defaultTags = ['Особисте', 'Сімейне', 'Робоче', 'Інше'];

const ensureDefaultFinanceData = async (userId, options = {}) => {
  const transaction = options.transaction;

  for (const category of defaultCategories) {
    await Category.findOrCreate({
      where: {
        userId,
        name: category.name,
        type: category.type,
      },
      defaults: {
        userId,
        ...category,
        isDefault: true,
      },
      transaction,
    });
  }

  for (const name of defaultTags) {
    await Tag.findOrCreate({
      where: {
        userId,
        name,
      },
      defaults: {
        userId,
        name,
        isDefault: true,
      },
      transaction,
    });
  }
};

const getFallbackCategory = (userId, type, options = {}) =>
  Category.findOne({
    where: {
      userId,
      type,
      name: 'Інше',
    },
    transaction: options.transaction,
  });

const getFallbackTag = (userId, options = {}) =>
  Tag.findOne({
    where: {
      userId,
      name: 'Інше',
    },
    transaction: options.transaction,
  });

module.exports = {
  defaultCategories,
  defaultTags,
  ensureDefaultFinanceData,
  getFallbackCategory,
  getFallbackTag,
};

const expenseMccCategories = [
  {
    categoryName: 'Продукти',
    codes: [5411, 5422, 5441, 5451, 5462, 5499],
  },
  {
    categoryName: 'Кафе',
    codes: [5811, 5812, 5813, 5814],
  },
  {
    categoryName: 'Комунальні',
    codes: [4900],
  },
  {
    categoryName: 'Звʼязок',
    codes: [4812, 4813, 4814, 4821],
  },
  {
    categoryName: 'Транспорт',
    codes: [4111, 4112, 4121, 4131, 4784, 5541, 5542, 7523],
  },
  {
    categoryName: 'Подорожі',
    codes: [3000, 3351, 3501, 4411, 4511, 4722, 7011, 7032, 7512],
  },
  {
    categoryName: 'Дім',
    codes: [5200, 5211, 5231, 5251, 5712, 5713, 5714],
  },
  {
    categoryName: 'Освіта',
    codes: [8211, 8220, 8241, 8244, 8249, 8299],
  },
  {
    categoryName: 'Здоровʼя',
    codes: [5912, 8011, 8021, 8031, 8041, 8042, 8043, 8049, 8062, 8099],
  },
  {
    categoryName: 'Підписки',
    codes: [4899, 5968, 5815, 5816, 5817, 5818],
  },
  {
    categoryName: 'Послуги',
    codes: [7299, 7399, 8999],
  },
  {
    categoryName: 'Розваги',
    codes: [7832, 7841, 7911, 7922, 7929, 7932, 7933, 7941, 7991, 7992, 7994, 7996, 7997, 7998, 7999],
  },
  {
    categoryName: 'Покупки',
    codes: [
      5310, 5311, 5331, 5399, 5611, 5621, 5631, 5641, 5651, 5655, 5661, 5691,
      5697, 5698, 5699, 5722, 5732, 5734, 5941, 5942, 5943, 5944, 5945, 5946,
      5947, 5948, 5949, 5977, 5999,
    ],
  },
];

const normalizeText = (value = '') => value.toLowerCase();

const getIncomeCategoryName = (description) => {
  const text = normalizeText(description);

  if (text.includes('зарплат') || text.includes('salary')) {
    return 'Зарплата';
  }

  if (text.includes('подар') || text.includes('gift')) {
    return 'Подарунки';
  }

  if (
    text.includes('переказ') ||
    text.includes('transfer') ||
    text.includes('від:') ||
    text.includes('від ')
  ) {
    return 'Перекази';
  }

  return 'Інше';
};

const getExpenseCategoryName = (mcc) => {
  const numericMcc = Number(mcc);

  if (!numericMcc) {
    return 'Інше';
  }

  return (
    expenseMccCategories.find((category) => category.codes.includes(numericMcc))
      ?.categoryName || 'Інше'
  );
};

const classifyMonobankTransaction = (item) => ({
  categoryName:
    item.type === 'income'
      ? getIncomeCategoryName(item.description)
      : getExpenseCategoryName(item.mcc || item.originalMcc),
  tagName: 'Інше',
});

module.exports = {
  classifyMonobankTransaction,
};

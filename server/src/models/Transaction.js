const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Transaction = sequelize.define(
  'Transaction',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    accountId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'account_id',
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'UAH',
    },
    type: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Операція',
    },
    transactionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'transaction_date',
    },
    source: {
      type: DataTypes.ENUM('manual', 'monobank'),
      allowNull: false,
      defaultValue: 'manual',
    },
    externalTransactionId: {
      type: DataTypes.STRING(160),
      allowNull: true,
      field: 'external_transaction_id',
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'category_id',
    },
    tagId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'tag_id',
    },
    status: {
      type: DataTypes.ENUM('confirmed', 'needs_review'),
      allowNull: false,
      defaultValue: 'confirmed',
    },
  },
  {
    tableName: 'transactions',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'source', 'external_transaction_id'],
      },
    ],
  },
);

module.exports = Transaction;

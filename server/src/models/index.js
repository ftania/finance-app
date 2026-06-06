const sequelize = require('../config/db');
const Account = require('./Account');
const BankConnection = require('./BankConnection');
const BudgetLimit = require('./BudgetLimit');
const Category = require('./Category');
const Tag = require('./Tag');
const Transaction = require('./Transaction');
const User = require('./User');

User.hasMany(BankConnection, {
  foreignKey: 'userId',
  as: 'bankConnections',
  onDelete: 'CASCADE',
});

BankConnection.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(Account, {
  foreignKey: 'userId',
  as: 'accounts',
  onDelete: 'CASCADE',
});

Account.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

BankConnection.hasMany(Account, {
  foreignKey: 'bankConnectionId',
  as: 'accounts',
  onDelete: 'CASCADE',
});

Account.belongsTo(BankConnection, {
  foreignKey: 'bankConnectionId',
  as: 'bankConnection',
});

User.hasMany(Category, {
  foreignKey: 'userId',
  as: 'categories',
  onDelete: 'CASCADE',
});

Category.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(Tag, {
  foreignKey: 'userId',
  as: 'tags',
  onDelete: 'CASCADE',
});

Tag.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(BudgetLimit, {
  foreignKey: 'userId',
  as: 'budgetLimits',
  onDelete: 'CASCADE',
});

BudgetLimit.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Category.hasMany(BudgetLimit, {
  foreignKey: 'categoryId',
  as: 'budgetLimits',
});

BudgetLimit.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category',
});

Tag.hasMany(BudgetLimit, {
  foreignKey: 'tagId',
  as: 'budgetLimits',
});

BudgetLimit.belongsTo(Tag, {
  foreignKey: 'tagId',
  as: 'tag',
});

User.hasMany(Transaction, {
  foreignKey: 'userId',
  as: 'transactions',
  onDelete: 'CASCADE',
});

Transaction.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Account.hasMany(Transaction, {
  foreignKey: 'accountId',
  as: 'transactions',
  onDelete: 'SET NULL',
});

Transaction.belongsTo(Account, {
  foreignKey: 'accountId',
  as: 'account',
});

Category.hasMany(Transaction, {
  foreignKey: 'categoryId',
  as: 'transactions',
});

Transaction.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category',
});

Tag.hasMany(Transaction, {
  foreignKey: 'tagId',
  as: 'transactions',
});

Transaction.belongsTo(Tag, {
  foreignKey: 'tagId',
  as: 'tag',
});

module.exports = {
  sequelize,
  Account,
  BankConnection,
  BudgetLimit,
  Category,
  Tag,
  Transaction,
  User,
};

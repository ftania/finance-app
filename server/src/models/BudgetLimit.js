const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BudgetLimit = sequelize.define(
  'BudgetLimit',
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
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'category_id',
    },
    tagId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'tag_id',
    },
    limitAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      field: 'limit_amount',
      validate: {
        min: 0.01,
      },
    },
    periodType: {
      type: DataTypes.ENUM('day', 'week', 'month', 'custom'),
      allowNull: false,
      defaultValue: 'month',
      field: 'period_type',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_date',
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_date',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    tableName: 'budget_limits',
  },
);

module.exports = BudgetLimit;

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Category = sequelize.define(
  'Category',
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
    name: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_default',
    },
  },
  {
    tableName: 'categories',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'name', 'type'],
      },
    ],
  },
);

module.exports = Category;

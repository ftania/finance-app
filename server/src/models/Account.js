const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Account = sequelize.define(
  'Account',
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
    bankConnectionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'bank_connection_id',
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'card',
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'UAH',
    },
    balance: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    externalAccountId: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'external_account_id',
    },
    isTracked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_tracked',
    },
  },
  {
    tableName: 'accounts',
    indexes: [
      {
        unique: true,
        fields: ['bank_connection_id', 'external_account_id'],
      },
    ],
  },
);

module.exports = Account;

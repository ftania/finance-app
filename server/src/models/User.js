const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'Користувач',
      field: 'full_name',
      validate: {
        len: [2, 80],
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
      set(value) {
        this.setDataValue('email', value.toLowerCase().trim());
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password_hash',
    },
    currency: {
      type: DataTypes.ENUM('UAH', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'UAH',
    },
    resetPasswordTokenHash: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'reset_password_token_hash',
    },
    resetPasswordExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_password_expires_at',
    },
  },
  {
    tableName: 'users',
    defaultScope: {
      attributes: {
        exclude: ['passwordHash', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'],
      },
    },
    scopes: {
      withPassword: {
        attributes: {},
      },
    },
  },
);

module.exports = User;

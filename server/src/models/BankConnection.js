const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { decryptToken, encryptToken, isEncryptedToken } = require('../services/tokenCrypto');

const BankConnection = sequelize.define(
  'BankConnection',
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
    bankName: {
      type: DataTypes.STRING(60),
      allowNull: false,
      field: 'bank_name',
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        return decryptToken(this.getDataValue('token'));
      },
      set(value) {
        this.setDataValue('token', encryptToken(value));
      },
    },
    status: {
      type: DataTypes.ENUM('connected', 'error'),
      allowNull: false,
      defaultValue: 'connected',
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_sync_at',
    },
  },
  {
    tableName: 'bank_connections',
    hooks: {
      beforeSave(connection) {
        const rawToken = connection.getDataValue('token');

        if (rawToken && !isEncryptedToken(rawToken)) {
          connection.setDataValue('token', encryptToken(rawToken));
        }
      },
    },
  },
);

module.exports = BankConnection;

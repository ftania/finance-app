const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Tag = sequelize.define(
  'Tag',
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
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_default',
    },
  },
  {
    tableName: 'tags',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'name'],
      },
    ],
  },
);

module.exports = Tag;

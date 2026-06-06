const app = require('./app');
const { BankConnection, sequelize } = require('./models');
const { encryptToken, isEncryptedToken } = require('./services/tokenCrypto');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const encryptStoredBankTokens = async () => {
  const connections = await BankConnection.findAll({
    attributes: ['id', 'token'],
  });

  await Promise.all(
    connections.map(async (connection) => {
      const rawToken = connection.getDataValue('token');

      if (!rawToken || isEncryptedToken(rawToken)) {
        return;
      }

      connection.setDataValue('token', encryptToken(rawToken));
      await connection.save({ hooks: false });
    }),
  );
};

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required');
    }

    await sequelize.authenticate();
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    await encryptStoredBankTokens();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message || error);
    process.exit(1);
  }
};

startServer();

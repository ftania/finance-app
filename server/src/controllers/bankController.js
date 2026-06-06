const { Account, BankConnection, Category, Transaction, sequelize } = require('../models');
const monobankAdapter = require('../adapters/monobankAdapter');
const {
  ensureDefaultFinanceData,
  getFallbackCategory,
  getFallbackTag,
} = require('../services/defaultFinanceData');
const { classifyMonobankTransaction } = require('../services/transactionClassifier');

const MONOBANK_NAME = 'monobank';
const MONOBANK_STATEMENT_DAYS = 31;

const serializeConnection = (connection) => ({
  id: connection.id,
  bankName: connection.bankName,
  status: connection.status,
  lastSyncAt: connection.lastSyncAt,
});

const serializeAccount = (account) => ({
  id: account.id,
  bankConnectionId: account.bankConnectionId,
  bankName: account.bankConnection?.bankName,
  connectionStatus: account.bankConnection?.status,
  lastSyncAt: account.bankConnection?.lastSyncAt,
  name: account.name,
  type: account.type,
  currency: account.currency,
  balance: Number(account.balance),
  externalAccountId: account.externalAccountId,
  isTracked: account.isTracked,
});

const upsertAccounts = async ({ userId, bankConnectionId, accounts, transaction }) => {
  for (const account of accounts) {
    const existingAccount = await Account.findOne({
      where: {
        userId,
        bankConnectionId,
        externalAccountId: account.externalAccountId,
      },
      transaction,
    });

    if (existingAccount) {
      await existingAccount.update(
        {
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: account.balance,
        },
        { transaction },
      );
      continue;
    }

    await Account.create(
      {
        userId,
        bankConnectionId,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balance: account.balance,
        externalAccountId: account.externalAccountId,
      },
      { transaction },
    );
  }
};

const syncMonobankTransactions = async ({ userId, connection, transaction }) => {
  await ensureDefaultFinanceData(userId, { transaction });

  const accounts = await Account.findAll({
    where: {
      userId,
      bankConnectionId: connection.id,
      isTracked: true,
    },
    transaction,
  });

  const fallbackIncomeCategory = await getFallbackCategory(userId, 'income', { transaction });
  const fallbackExpenseCategory = await getFallbackCategory(userId, 'expense', { transaction });
  const fallbackTag = await getFallbackTag(userId, { transaction });
  const categories = await Category.findAll({
    where: { userId },
    transaction,
  });
  const to = Math.floor(Date.now() / 1000);
  const from = to - MONOBANK_STATEMENT_DAYS * 24 * 60 * 60;
  let importedCount = 0;
  const syncErrors = [];

  for (const account of accounts) {
    let statementItems = [];

    try {
      statementItems = await monobankAdapter.getStatement({
        token: connection.token,
        accountId: account.externalAccountId,
        from,
        to,
        currency: account.currency,
      });
    } catch (error) {
      syncErrors.push({
        accountId: account.id,
        accountName: account.name,
        message: error.message,
      });
      continue;
    }

    for (const item of statementItems) {
      const classification = classifyMonobankTransaction(item);
      const detectedCategory = categories.find(
        (category) =>
          category.type === item.type && category.name === classification.categoryName,
      );
      const fallbackCategory =
        item.type === 'income' ? fallbackIncomeCategory : fallbackExpenseCategory;
      const category = detectedCategory || fallbackCategory;

      const [createdTransaction, created] = await Transaction.findOrCreate({
        where: {
          userId,
          source: 'monobank',
          externalTransactionId: item.externalTransactionId,
        },
        defaults: {
          userId,
          accountId: account.id,
          amount: item.amount,
          currency: item.currency,
          type: item.type,
          description: item.description,
          transactionDate: item.transactionDate,
          source: item.source,
          externalTransactionId: item.externalTransactionId,
          categoryId: category.id,
          tagId: fallbackTag.id,
          status: 'needs_review',
        },
        transaction,
      });

      if (!created) {
        createdTransaction.accountId = account.id;
        createdTransaction.amount = item.amount;
        createdTransaction.currency = item.currency;
        createdTransaction.type = item.type;
        createdTransaction.description = item.description;
        createdTransaction.transactionDate = item.transactionDate;

        if (createdTransaction.status !== 'confirmed') {
          createdTransaction.categoryId = category.id;
          createdTransaction.tagId = fallbackTag.id;
          createdTransaction.status = 'needs_review';
        }

        await createdTransaction.save({ transaction });
      } else {
        importedCount += 1;
      }
    }
  }

  return {
    importedCount,
    syncErrors,
    checkedAccounts: accounts.length,
  };
};

const getAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.findAll({
      where: { userId: req.userId },
      include: [
        {
          model: BankConnection,
          as: 'bankConnection',
          attributes: ['id', 'bankName', 'status', 'lastSyncAt'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    const connections = await BankConnection.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'ASC']],
    });

    return res.json({
      accounts: accounts.map(serializeAccount),
      connections: connections.map(serializeConnection),
    });
  } catch (error) {
    return next(error);
  }
};

const updateAccountTracking = async (req, res, next) => {
  try {
    const account = await Account.findOne({
      where: {
        id: req.params.accountId,
        userId: req.userId,
      },
      include: [
        {
          model: BankConnection,
          as: 'bankConnection',
          attributes: ['id', 'bankName', 'status', 'lastSyncAt'],
        },
      ],
    });

    if (!account) {
      return res.status(404).json({ message: 'Рахунок не знайдено' });
    }

    account.isTracked = Boolean(req.body.isTracked);
    await account.save();

    return res.json({
      account: serializeAccount(account),
      message: account.isTracked
        ? 'Рахунок додано до відстеження'
        : 'Рахунок виключено з відстеження',
    });
  } catch (error) {
    return next(error);
  }
};

const connectMonobank = async (req, res, next) => {
  try {
    const { token = '' } = req.body;
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      return res.status(400).json({ message: 'Вкажіть token Monobank' });
    }

    const clientInfo = await monobankAdapter.getClientInfo(normalizedToken);

    if (clientInfo.accounts.length === 0) {
      return res.status(400).json({ message: 'Monobank не повернув рахунки' });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const [connection] = await BankConnection.findOrCreate({
        where: {
          userId: req.userId,
          bankName: MONOBANK_NAME,
        },
        defaults: {
          userId: req.userId,
          bankName: MONOBANK_NAME,
          token: normalizedToken,
          status: 'connected',
          lastSyncAt: new Date(),
        },
        transaction,
      });

      connection.token = normalizedToken;
      connection.status = 'connected';
      connection.lastSyncAt = new Date();
      await connection.save({ transaction });

      await upsertAccounts({
        userId: req.userId,
        bankConnectionId: connection.id,
        accounts: clientInfo.accounts,
        transaction,
      });

      return connection;
    });

    return res.status(201).json({
      connection: serializeConnection(result),
      message: 'Monobank підключено',
    });
  } catch (error) {
    return next(error);
  }
};

const syncMonobank = async (req, res, next) => {
  try {
    const connection = await BankConnection.findOne({
      where: {
        id: req.params.connectionId,
        userId: req.userId,
        bankName: MONOBANK_NAME,
      },
    });

    if (!connection) {
      return res.status(404).json({ message: 'Підключення Monobank не знайдено' });
    }

    try {
      const clientInfo = await monobankAdapter.getClientInfo(connection.token);

      const syncResult = await sequelize.transaction(async (transaction) => {
        connection.status = 'connected';
        connection.lastSyncAt = new Date();
        await connection.save({ transaction });

        await upsertAccounts({
          userId: req.userId,
          bankConnectionId: connection.id,
          accounts: clientInfo.accounts,
          transaction,
        });

        return syncMonobankTransactions({
          userId: req.userId,
          connection,
          transaction,
        });
      });

      if (syncResult.syncErrors.length > 0) {
        connection.status = 'error';
        await connection.save();
      }

      return res.json({
        connection: serializeConnection(connection),
        importedCount: syncResult.importedCount,
        syncErrors: syncResult.syncErrors,
        message:
          syncResult.syncErrors.length > 0
            ? 'Частину транзакцій синхронізовано, але деякі рахунки тимчасово недоступні'
            : 'Рахунки й транзакції синхронізовано',
      });
    } catch (syncError) {
      connection.status = 'error';
      await connection.save();
      return res.status(400).json({ message: syncError.message });
    }
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  connectMonobank,
  getAccounts,
  syncMonobank,
  updateAccountTracking,
};

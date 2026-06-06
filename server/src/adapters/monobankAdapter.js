const MONOBANK_API_URL = 'https://api.monobank.ua';

const currencyByCode = {
  840: 'USD',
  978: 'EUR',
  980: 'UAH',
};

const getCurrency = (currencyCode) => currencyByCode[currencyCode] || 'UAH';

const getAccountName = (account) => {
  if (account.maskedPan?.length) {
    return `Картка ${account.maskedPan[0]}`;
  }

  if (account.type) {
    return `Monobank ${account.type}`;
  }

  return 'Monobank рахунок';
};

const mapAccount = (account) => ({
  externalAccountId: account.id,
  name: getAccountName(account),
  type: account.type || 'card',
  currency: getCurrency(account.currencyCode),
  balance: Number(((account.balance || 0) / 100).toFixed(2)),
});

const mapStatementItem = (item, accountCurrency) => {
  const amount = Number(((item.amount || 0) / 100).toFixed(2));
  const description = [item.description, item.comment, item.counterName]
    .filter(Boolean)
    .join(' · ');

  return {
    externalTransactionId: item.id,
    amount: Math.abs(amount),
    currency: accountCurrency,
    type: amount >= 0 ? 'income' : 'expense',
    description: description || 'Monobank операція',
    transactionDate: new Date((item.time || Math.floor(Date.now() / 1000)) * 1000),
    source: 'monobank',
    mcc: item.mcc,
    originalMcc: item.originalMcc,
    status: 'needs_review',
  };
};

const buildMonobankError = (response) => {
  const messageByStatus = {
    403: 'Monobank token недійсний або не має доступу',
    429: 'Monobank тимчасово обмежив частоту запитів',
  };
  const error = new Error(
    messageByStatus[response.status] || 'Не вдалося отримати дані Monobank',
  );
  error.statusCode = response.status === 429 ? 429 : 400;
  return error;
};

const getClientInfo = async (token) => {
  const response = await fetch(`${MONOBANK_API_URL}/personal/client-info`, {
    headers: {
      'X-Token': token,
    },
  });

  if (!response.ok) {
    throw buildMonobankError(response);
  }

  const data = await response.json();

  return {
    clientId: data.clientId,
    name: data.name,
    accounts: Array.isArray(data.accounts) ? data.accounts.map(mapAccount) : [],
  };
};

const getStatement = async ({ token, accountId, from, to, currency }) => {
  const response = await fetch(
    `${MONOBANK_API_URL}/personal/statement/${accountId}/${from}/${to}`,
    {
      headers: {
        'X-Token': token,
      },
    },
  );

  if (!response.ok) {
    throw buildMonobankError(response);
  }

  const data = await response.json();
  return Array.isArray(data)
    ? data.map((item) => mapStatementItem(item, currency))
    : [];
};

module.exports = {
  getClientInfo,
  getStatement,
};

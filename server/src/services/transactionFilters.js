const INTERNAL_TRANSFER_PATTERNS = [
  /^З гривневого рахунку ФОП/i,
  /^З доларового рахунку ФОП/i,
  /^На чорну картку/i,
];

const isInternalTransfer = (transaction) => {
  if (transaction.source !== 'monobank') {
    return false;
  }

  return INTERNAL_TRANSFER_PATTERNS.some((pattern) =>
    pattern.test(transaction.description || ''),
  );
};

const excludeInternalTransfers = (transactions) =>
  transactions.filter((transaction) => !isInternalTransfer(transaction));

module.exports = {
  excludeInternalTransfers,
  isInternalTransfer,
};

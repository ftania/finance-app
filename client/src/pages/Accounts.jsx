import {
  Building2,
  Clock3,
  Eye,
  EyeOff,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/api";

const formatMoney = (amount, currency) =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(amount || 0));

const formatDate = (date) => {
  if (!date) {
    return "Ще не синхронізовано";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [syncWarnings, setSyncWarnings] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState("");
  const [updatingAccountId, setUpdatingAccountId] = useState("");

  const monoConnection = useMemo(
    () => connections.find((connection) => connection.bankName === "monobank"),
    [connections],
  );
  const trackedAccountsCount = useMemo(
    () => accounts.filter((account) => account.isTracked).length,
    [accounts],
  );

  const loadAccounts = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      const { data } = await api.get("/banks/accounts");
      setAccounts(data.accounts || []);
      setConnections(data.connections || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Не вдалося завантажити рахунки",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let shouldIgnore = false;

    async function loadInitialAccounts() {
      try {
        const { data } = await api.get("/banks/accounts");

        if (!shouldIgnore) {
          setAccounts(data.accounts || []);
          setConnections(data.connections || []);
        }
      } catch (requestError) {
        if (!shouldIgnore) {
          setError(
            requestError.response?.data?.message ||
              "Не вдалося завантажити рахунки",
          );
        }
      } finally {
        if (!shouldIgnore) {
          setIsLoading(false);
        }
      }
    }

    loadInitialAccounts();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  const handleConnect = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSyncWarnings([]);
    setIsConnecting(true);

    try {
      const { data } = await api.post("/banks/monobank/connect", { token });
      setMessage(data.message);
      setToken("");
      await loadAccounts({ showLoader: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Не вдалося підключити Monobank",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async (connectionId) => {
    setError("");
    setMessage("");
    setSyncWarnings([]);
    setSyncingId(connectionId);

    try {
      const { data } = await api.post(`/banks/monobank/${connectionId}/sync`);
      setMessage(
        typeof data.importedCount === "number"
          ? `${data.message}. Нових транзакцій: ${data.importedCount}`
          : data.message,
      );
      setSyncWarnings(data.syncErrors || []);
      await loadAccounts({ showLoader: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Не вдалося синхронізувати рахунки",
      );
      await loadAccounts({ showLoader: true });
    } finally {
      setSyncingId("");
    }
  };

  const handleTrackingToggle = async (account) => {
    setError("");
    setMessage("");
    setSyncWarnings([]);
    setUpdatingAccountId(account.id);

    try {
      const { data } = await api.patch(
        `/banks/accounts/${account.id}/tracking`,
        {
          isTracked: !account.isTracked,
        },
      );

      setMessage(data.message);
      setAccounts((currentAccounts) =>
        currentAccounts.map((currentAccount) =>
          currentAccount.id === account.id ? data.account : currentAccount,
        ),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Не вдалося оновити рахунок",
      );
    } finally {
      setUpdatingAccountId("");
    }
  };

  return (
    <main className="content-page">
      <section className="content-header">
        <div>
          <span className="eyebrow">Банки / Рахунки</span>
          <h1>Підключені рахунки</h1>
          <p>
            Додайте Monobank token, щоб бачити актуальні баланси рахунків в
            одному місці
          </p>
        </div>
      </section>

      <section className="accounts-grid">
        <form className="accounts-panel" onSubmit={handleConnect}>
          <div className="panel-heading">
            <Building2 size={22} aria-hidden="true" />
            <div>
              <span>Monobank</span>
              <h2>Підключення через token</h2>
            </div>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          {syncWarnings.length ? (
            <div className="form-warning">
              {syncWarnings.map((warning) => (
                <span key={warning.accountId}>
                  {warning.accountName}: {warning.message}
                </span>
              ))}
            </div>
          ) : null}

          <label className="field">
            <span>Token</span>
            <div className="input-wrap">
              <input
                autoComplete="off"
                name="token"
                onChange={(event) => setToken(event.target.value)}
                placeholder="Вставте token Monobank"
                required
                type="password"
                value={token}
              />
            </div>
          </label>

          <button
            className="primary-button"
            disabled={isConnecting}
            type="submit"
          >
            {isConnecting ? "Підключаємо..." : "Підключити Monobank"}
          </button>

          <div className="sync-row">
            <div>
              <span>Остання синхронізація</span>
              <strong>{formatDate(monoConnection?.lastSyncAt)}</strong>
            </div>
            <button
              className="ghost-button"
              disabled={!monoConnection || Boolean(syncingId)}
              onClick={() => handleSync(monoConnection.id)}
              type="button"
            >
              <RefreshCw size={18} aria-hidden="true" />
              {syncingId ? "Синхронізуємо..." : "Синхронізувати"}
            </button>
          </div>
        </form>

        <section className="accounts-panel account-list-panel">
          <div className="panel-heading">
            <WalletCards size={22} aria-hidden="true" />
            <div>
              <span>Рахунки</span>
              <h2>
                {accounts.length
                  ? `${trackedAccountsCount} з ${accounts.length} відстежується`
                  : "Список порожній"}
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="empty-state">
              <Clock3 size={22} aria-hidden="true" />
              Завантажуємо рахунки...
            </div>
          ) : accounts.length ? (
            <div className="account-list">
              {accounts.map((account) => (
                <article
                  className={
                    account.isTracked
                      ? "account-item"
                      : "account-item account-item-muted"
                  }
                  key={account.id}
                >
                  <div className="account-icon">
                    <WalletCards size={20} aria-hidden="true" />
                  </div>
                  <div className="account-meta">
                    <h3>{account.name}</h3>
                    <span>
                      {account.bankName} · {account.type}
                    </span>
                  </div>
                  <strong>
                    {formatMoney(account.balance, account.currency)}
                  </strong>
                  <button
                    className={
                      account.isTracked
                        ? "account-track-toggle is-active"
                        : "account-track-toggle"
                    }
                    disabled={updatingAccountId === account.id}
                    onClick={() => handleTrackingToggle(account)}
                    type="button"
                  >
                    {account.isTracked ? (
                      <Eye size={16} aria-hidden="true" />
                    ) : (
                      <EyeOff size={16} aria-hidden="true" />
                    )}
                    <span>
                      {updatingAccountId === account.id
                        ? "Оновлюємо..."
                        : account.isTracked
                          ? "Відстежується"
                          : "Не відстежується"}
                    </span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <WalletCards size={22} aria-hidden="true" />
              Після підключення банку тут зʼявляться рахунки.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

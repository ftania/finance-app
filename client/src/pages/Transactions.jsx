import { Check, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/useAuth";

const initialFilters = {
  period: "month",
  type: "",
  categoryId: "",
  tagId: "",
  search: "",
};

const initialForm = {
  accountId: "",
  amount: "",
  currency: "UAH",
  type: "expense",
  description: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  categoryId: "",
  tagId: "",
};

const formatMoney = (amount, currency) =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(amount || 0));

const formatDate = (date) =>
  new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
  }).format(new Date(date));

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [form, setForm] = useState({
    ...initialForm,
    currency: user?.currency || "UAH",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (category) => !filters.type || category.type === filters.type,
      ),
    [categories, filters.type],
  );

  const formCategories = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type],
  );

  const loadTransactions = useCallback(async (overrides = {}) => {
    const params = new URLSearchParams();
    const nextPage = overrides.page || pagination.page;
    const nextLimit = overrides.limit || pagination.limit;

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("page", String(nextPage));
    params.set("limit", String(nextLimit));

    const { data } = await api.get(`/transactions?${params.toString()}`);
    setTransactions(data.transactions || []);
    setPagination((current) => ({
      ...current,
      ...(data.pagination || {}),
    }));
  }, [filters, pagination.limit, pagination.page]);

  useEffect(() => {
    let shouldIgnore = false;

    async function loadInitialData() {
      try {
        const metaResponse = await api.get("/transactions/meta");
        const params = new URLSearchParams({
          period: initialFilters.period,
          page: "1",
          limit: "20",
        });
        const transactionsResponse = await api.get(`/transactions?${params.toString()}`);

        if (!shouldIgnore) {
          const nextCategories = metaResponse.data.categories || [];
          const nextTags = metaResponse.data.tags || [];
          setCategories(nextCategories);
          setTags(nextTags);
          setAccounts(metaResponse.data.accounts || []);
          setTransactions(transactionsResponse.data.transactions || []);
          setPagination((current) => ({
            ...current,
            ...(transactionsResponse.data.pagination || {}),
          }));

          setForm((current) => ({
            ...current,
            categoryId:
              nextCategories.find(
                (category) =>
                  category.type === current.type && category.name === "Інше",
              )?.id || "",
            tagId: nextTags.find((tag) => tag.name === "Інше")?.id || "",
          }));
        }
      } catch (requestError) {
        if (!shouldIgnore) {
          setError(
            requestError.response?.data?.message ||
              "Не вдалося завантажити транзакції",
          );
        }
      } finally {
        if (!shouldIgnore) {
          setIsLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const timeoutId = window.setTimeout(() => {
        loadTransactions().catch((requestError) => {
          setError(
            requestError.response?.data?.message ||
              "Не вдалося застосувати фільтри",
          );
        });
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [filters, isLoading, loadTransactions]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === "type" ? { categoryId: "" } : {}),
    }));
    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "type"
        ? {
            categoryId:
              categories.find(
                (category) => category.type === value && category.name === "Інше",
              )?.id || "",
          }
        : {}),
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsCreating(true);

    try {
      const payload = {
        ...form,
        accountId: form.accountId || null,
      };
      const { data } = await api.post("/transactions", payload);
      setMessage(data.message);
      setForm((current) => ({
        ...initialForm,
        currency: user?.currency || "UAH",
        categoryId: current.categoryId,
        tagId: current.tagId,
      }));
      setPagination((current) => ({ ...current, page: 1 }));
      await loadTransactions({ page: 1 });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не вдалося додати транзакцію");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClassificationChange = async (transaction, field, value) => {
    setError("");
    setMessage("");

    const payload = {
      categoryId: field === "categoryId" ? value : transaction.categoryId,
      tagId: field === "tagId" ? value : transaction.tagId,
    };

    try {
      await api.patch(`/transactions/${transaction.id}/classification`, payload);
      await loadTransactions();
      setMessage("Транзакцію оновлено");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не вдалося оновити транзакцію");
    }
  };

  return (
    <main className="content-page">
      <section className="content-header">
        <div>
          <span className="eyebrow">Транзакції</span>
          <h1>Операції з коштами</h1>
          <p>
            Переглядайте імпортовані операції, додавайте ручні транзакції та
            уточнюйте категорії й теги
          </p>
        </div>
        <div className="connection-status-card">
          <SlidersHorizontal size={22} aria-hidden="true" />
              <div>
                <span>Фільтри</span>
            <strong>{pagination.total} операцій</strong>
              </div>
        </div>
      </section>

      <section className="transactions-layout">
        <aside className="transactions-side-panel">
          <form className="transaction-form" onSubmit={handleCreate}>
            <div className="panel-heading">
              <Plus size={22} aria-hidden="true" />
              <div>
                <span>Вручну</span>
                <h2>Нова транзакція</h2>
              </div>
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            {message ? <p className="form-success">{message}</p> : null}

            <label className="field">
              <span>Тип</span>
              <div className="input-wrap select-wrap">
                <select name="type" onChange={handleFormChange} value={form.type}>
                  <option value="expense">Витрата</option>
                  <option value="income">Дохід</option>
                </select>
              </div>
            </label>

            <label className="field">
              <span>Сума</span>
              <div className="input-wrap">
                <input
                  min="0.01"
                  name="amount"
                  onChange={handleFormChange}
                  required
                  step="0.01"
                  type="number"
                  value={form.amount}
                />
              </div>
            </label>

            <label className="field">
              <span>Опис</span>
              <div className="input-wrap">
                <input
                  name="description"
                  onChange={handleFormChange}
                  placeholder="Наприклад, кава"
                  type="text"
                  value={form.description}
                />
              </div>
            </label>

            <label className="field">
              <span>Рахунок</span>
              <div className="input-wrap select-wrap">
                <select
                  name="accountId"
                  onChange={handleFormChange}
                  value={form.accountId}
                >
                  <option value="">Без рахунку</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="field">
              <span>Дата</span>
              <div className="input-wrap">
                <input
                  name="transactionDate"
                  onChange={handleFormChange}
                  required
                  type="date"
                  value={form.transactionDate}
                />
              </div>
            </label>

            <label className="field">
              <span>Категорія</span>
              <div className="input-wrap select-wrap">
                <select
                  name="categoryId"
                  onChange={handleFormChange}
                  required
                  value={form.categoryId}
                >
                  {formCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="field">
              <span>Тег</span>
              <div className="input-wrap select-wrap">
                <select name="tagId" onChange={handleFormChange} required value={form.tagId}>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <button className="primary-button" disabled={isCreating} type="submit">
              {isCreating ? "Додаємо..." : "Додати транзакцію"}
            </button>
          </form>
        </aside>

        <section className="transactions-main-panel">
          <div className="transaction-filters">
            <div className="input-wrap select-wrap">
              <select name="period" onChange={handleFilterChange} value={filters.period}>
                <option value="today">День</option>
                <option value="week">Тиждень</option>
                <option value="month">Місяць</option>
                <option value="year">Рік</option>
              </select>
            </div>
            <div className="input-wrap select-wrap">
              <select name="type" onChange={handleFilterChange} value={filters.type}>
                <option value="">Усі типи</option>
                <option value="income">Доходи</option>
                <option value="expense">Витрати</option>
              </select>
            </div>
            <div className="input-wrap select-wrap">
              <select
                name="categoryId"
                onChange={handleFilterChange}
                value={filters.categoryId}
              >
                <option value="">Усі категорії</option>
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-wrap select-wrap">
              <select name="tagId" onChange={handleFilterChange} value={filters.tagId}>
                <option value="">Усі теги</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-wrap search-wrap">
              <Search size={18} aria-hidden="true" />
              <input
                name="search"
                onChange={handleFilterChange}
                placeholder="Пошук за описом"
                type="search"
                value={filters.search}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="empty-state">Завантажуємо транзакції...</div>
          ) : transactions.length ? (
            <div className="transaction-list">
              {transactions.map((transaction) => (
                <article
                  className={`transaction-card ${transaction.type}`}
                  key={transaction.id}
                >
                  <div className="transaction-main">
                    <div className="transaction-sign">
                      {transaction.type === "income" ? "+" : "-"}
                    </div>
                    <div>
                      <h3>{transaction.description}</h3>
                      <span>
                        {formatDate(transaction.transactionDate)} ·{" "}
                        {transaction.accountName || transaction.source}
                      </span>
                    </div>
                  </div>

                  <strong className="transaction-amount">
                    {transaction.type === "income" ? "+" : "-"}
                    {formatMoney(transaction.amount, transaction.currency)}
                  </strong>

                  <div className="transaction-classification">
                    <div className="input-wrap select-wrap">
                      <select
                        onChange={(event) =>
                          handleClassificationChange(
                            transaction,
                            "categoryId",
                            event.target.value,
                          )
                        }
                        value={transaction.categoryId}
                      >
                        {categories
                          .filter((category) => category.type === transaction.type)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="input-wrap select-wrap">
                      <select
                        onChange={(event) =>
                          handleClassificationChange(
                            transaction,
                            "tagId",
                            event.target.value,
                          )
                        }
                        value={transaction.tagId}
                      >
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className={`review-pill ${transaction.status}`}>
                      <Check size={14} aria-hidden="true" />
                      {transaction.status === "confirmed" ? "Готово" : "Перевірити"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">За вибраними фільтрами операцій немає.</div>
          )}

          <div className="pagination-bar">
            <span>
              Сторінка {pagination.page} з {pagination.totalPages}
            </span>
            <div>
              <button
                className="ghost-button"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: Math.max(current.page - 1, 1),
                  }))
                }
                type="button"
              >
                Назад
              </button>
              <button
                className="ghost-button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: Math.min(current.page + 1, current.totalPages),
                  }))
                }
                type="button"
              >
                Вперед
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

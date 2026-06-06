import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  PieChart,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/useAuth";

const defaultSummary = {
  activeAccountsCount: 0,
  currency: "UAH",
  exchangeRateDate: null,
  totalBalance: 0,
  todayIncome: 0,
  todayExpense: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,
  monthlyResult: 0,
  budgetLimitsTotal: 0,
  budgetLimitsExceeded: 0,
  recentTransactions: [],
  expensesByCategory: [],
  cashflowByDay: [],
};

const formatMoney = (amount, currency = "UAH") =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(amount || 0));

const formatDateTime = (date) =>
  new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

const formatFullDate = (date = new Date()) =>
  new Intl.DateTimeFormat("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));

const getBarHeight = (amount, maxAmount) => {
  if (!amount) {
    return "0%";
  }

  return `${Math.max(8, (amount / maxAmount) * 100)}%`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(defaultSummary);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const currency = summary.currency || user?.currency || "UAH";

  useEffect(() => {
    let shouldIgnore = false;

    async function loadDashboard() {
      setError("");

      try {
        const { data } = await api.get("/dashboard");

        if (!shouldIgnore) {
          setSummary({ ...defaultSummary, ...data });
        }
      } catch (requestError) {
        if (!shouldIgnore) {
          setError(
            requestError.response?.data?.message ||
              "Не вдалося завантажити Dashboard",
          );
        }
      } finally {
        if (!shouldIgnore) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  const chartMax = useMemo(
    () =>
      Math.max(
        1,
        ...summary.cashflowByDay.flatMap((day) => [day.income, day.expense]),
      ),
    [summary.cashflowByDay],
  );
  const categoryTotal = useMemo(
    () =>
      summary.expensesByCategory.reduce(
        (total, category) => total + Number(category.amount || 0),
        0,
      ),
    [summary.expensesByCategory],
  );
  const hasDashboardData =
    summary.activeAccountsCount > 0 ||
    summary.recentTransactions.length > 0 ||
    categoryTotal > 0;

  const metricCards = [
    {
      title: "Доходи сьогодні",
      value: summary.todayIncome,
      icon: ArrowUpRight,
      tone: "success",
    },
    {
      title: "Витрати сьогодні",
      value: summary.todayExpense,
      icon: ArrowDownLeft,
      tone: "danger",
    },
    {
      title: "Доходи місяця",
      value: summary.monthlyIncome,
      icon: TrendingUp,
      tone: "primary",
    },
    {
      title: "Витрати місяця",
      value: summary.monthlyExpense,
      icon: TrendingDown,
      tone: "amber",
    },
  ];

  return (
    <main className="content-page">
      <section className="dashboard-hero dashboard-hero-rich">
        <div>
          <span className="eyebrow">{formatFullDate(summary.currentDate)}</span>
          <h1>Вітаємо, {user?.fullName || "радо бачити вас"}</h1>
          <p>
            Огляд активних рахунків, руху коштів за день і фінансового
            результату поточного місяця
          </p>
        </div>

        <div className="balance-card">
          <span className="balance-card-label">
            <WalletCards size={18} aria-hidden="true" />
            Загальний баланс
          </span>
          <strong>{formatMoney(summary.totalBalance, currency)}</strong>
          <small>
            {summary.activeAccountsCount
              ? `${summary.activeAccountsCount} активних рахунків`
              : "Активних рахунків немає"}
          </small>
        </div>
      </section>

      {error ? <p className="form-error dashboard-error">{error}</p> : null}

      {isLoading ? (
        <section className="dashboard-loading">
          <Clock3 size={22} aria-hidden="true" />
          Завантажуємо фінансовий огляд...
        </section>
      ) : null}

      {!isLoading && !error && !hasDashboardData ? (
        <section className="dashboard-empty">
          <WalletCards size={28} aria-hidden="true" />
          <h2>Поки немає даних для Dashboard</h2>
          <p>
            Підключіть рахунок або додайте перші транзакції, і тут зʼявиться
            повна картина бюджету.
          </p>
        </section>
      ) : null}

      {!isLoading && !error ? (
        <>
          <section className="dashboard-grid dashboard-metrics-grid">
            {metricCards.map((card) => {
              const Icon = card.icon;

              return (
                <article className={`status-card metric-card ${card.tone}`} key={card.title}>
                  <div className="metric-icon">
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <span>{card.title}</span>
                  <strong>{formatMoney(card.value, currency)}</strong>
                </article>
              );
            })}

            <article
              className={
                summary.monthlyResult >= 0
                  ? "status-card result-card positive"
                  : "status-card result-card negative"
              }
            >
              <div className="metric-icon">
                <CircleDollarSign size={22} aria-hidden="true" />
              </div>
              <span>Результат місяця</span>
              <strong>{formatMoney(summary.monthlyResult, currency)}</strong>
              <p>
                {summary.monthlyResult >= 0
                  ? "Доходи перевищують витрати"
                  : "Витрати перевищують доходи"}
              </p>
            </article>

            <article
              className={
                summary.budgetLimitsExceeded > 0
                  ? "status-card budget-limits-card warning"
                  : "status-card budget-limits-card safe"
              }
            >
              <div className="metric-icon">
                <ShieldCheck size={22} aria-hidden="true" />
              </div>
              <span>Ліміти</span>
              <strong>{summary.budgetLimitsTotal}</strong>
              <p>
                {summary.budgetLimitsExceeded > 0
                  ? `${summary.budgetLimitsExceeded} перевищено`
                  : "Перевищених немає"}
              </p>
            </article>
          </section>

          <section className="dashboard-chart-panel dashboard-panel">
            <div className="panel-heading">
              <CalendarDays size={22} aria-hidden="true" />
              <div>
                <span>Останні 7 днів</span>
                <h2>Доходи та витрати</h2>
              </div>
            </div>

            {summary.cashflowByDay.some((day) => day.income || day.expense) ? (
              <div className="cashflow-chart">
                {summary.cashflowByDay.map((day) => (
                  <div className="cashflow-day" key={day.date}>
                    <div className="cashflow-bars">
                      <span
                        className="cashflow-bar income"
                        style={{ height: getBarHeight(day.income, chartMax) }}
                        title={`Доходи: ${formatMoney(day.income, currency)}`}
                      />
                      <span
                        className="cashflow-bar expense"
                        style={{ height: getBarHeight(day.expense, chartMax) }}
                        title={`Витрати: ${formatMoney(day.expense, currency)}`}
                      />
                    </div>
                    <span>{day.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">За останні 7 днів руху коштів немає.</div>
            )}

            <div className="chart-legend">
              <span>
                <i className="legend-dot income" />
                Доходи
              </span>
              <span>
                <i className="legend-dot expense" />
                Витрати
              </span>
            </div>
          </section>

          <section className="dashboard-bottom-grid">
            <article className="dashboard-panel">
              <div className="panel-heading">
                <Clock3 size={22} aria-hidden="true" />
                <div>
                  <span>Останні операції</span>
                  <h2>Рух коштів</h2>
                </div>
              </div>

              {summary.recentTransactions.length ? (
                <div className="mini-transaction-list">
                  {summary.recentTransactions.map((transaction) => (
                    <div className="mini-transaction" key={transaction.id}>
                      <div className={`transaction-sign ${transaction.type}`}>
                        {transaction.type === "income" ? "+" : "-"}
                      </div>
                      <div className="mini-transaction-main">
                        <strong>{transaction.description}</strong>
                        <span>{formatDateTime(transaction.transactionDate)}</span>
                        <div className="mini-badges">
                          <b>{transaction.categoryName || "Інше"}</b>
                          <b>{transaction.tagName || "Інше"}</b>
                        </div>
                      </div>
                      <strong className={`mini-amount ${transaction.type}`}>
                        {transaction.type === "income" ? "+" : "-"}
                        {formatMoney(transaction.amount, transaction.currency)}
                        {transaction.wasConverted ? (
                          <small>
                            {formatMoney(
                              transaction.originalAmount,
                              transaction.originalCurrency,
                            )}
                          </small>
                        ) : null}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Поки немає транзакцій.</div>
              )}
            </article>

            <article className="dashboard-panel">
              <div className="panel-heading">
                <PieChart size={22} aria-hidden="true" />
                <div>
                  <span>Поточний місяць</span>
                  <h2>Витрати за категоріями</h2>
                </div>
              </div>

              {summary.expensesByCategory.length ? (
                <div className="category-summary-list">
                  {summary.expensesByCategory.map((category) => {
                    const percent = categoryTotal
                      ? Math.round((Number(category.amount) / categoryTotal) * 100)
                      : 0;

                    return (
                      <div className="category-summary-item" key={category.name}>
                        <div>
                          <span>{category.name}</span>
                          <div className="category-progress">
                            <i style={{ width: `${Math.max(percent, 4)}%` }} />
                          </div>
                        </div>
                        <strong>{formatMoney(category.amount, currency)}</strong>
                        <em>{percent}%</em>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  У поточному місяці витрат за категоріями ще немає.
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}
    </main>
  );
}

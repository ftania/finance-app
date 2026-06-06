import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  PieChart,
  Tags,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/api";
import { useAuth } from "../context/useAuth";

const initialFilters = {
  period: "month",
  dateFrom: "",
  dateTo: "",
};

const initialAnalytics = {
  currency: "UAH",
  exchangeRateDate: null,
  activeAccountsCount: 0,
  totalIncome: 0,
  totalExpense: 0,
  financialResult: 0,
  averageDailyExpense: 0,
  expensesByCategory: [],
  expensesByTag: [],
  topExpenses: [],
  cashflow: [],
  monthComparison: {
    current: { income: 0, expense: 0, result: 0 },
    previous: { income: 0, expense: 0, result: 0 },
  },
};

const periodOptions = [
  { label: "Тиждень", value: "week" },
  { label: "Місяць", value: "month" },
  { label: "Рік", value: "year" },
  { label: "Власний", value: "custom" },
];

const chartColors = ["#2563EB", "#F59E0B", "#16A34A", "#EF4444", "#8B5CF6", "#14B8A6"];

const formatMoney = (amount, currency = "UAH") =>
  new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(amount || 0));

const formatDate = (date) =>
  new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));

const getBarHeight = (amount, maxAmount) => {
  if (!amount) {
    return "0%";
  }

  return `${Math.max(8, (amount / maxAmount) * 100)}%`;
};

export default function Analytics() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const currency = analytics.currency || user?.currency || "UAH";

  useEffect(() => {
    let shouldIgnore = false;

    async function loadAnalytics() {
      setError("");
      setIsLoading(true);

      try {
        const params = new URLSearchParams({ period: filters.period });

        if (filters.period === "custom") {
          if (filters.dateFrom) {
            params.set("dateFrom", filters.dateFrom);
          }

          if (filters.dateTo) {
            params.set("dateTo", filters.dateTo);
          }
        }

        const { data } = await api.get(`/analytics?${params.toString()}`);

        if (!shouldIgnore) {
          setAnalytics({ ...initialAnalytics, ...data });
        }
      } catch (requestError) {
        if (!shouldIgnore) {
          setError(
            requestError.response?.data?.message ||
              "Не вдалося завантажити аналітику",
          );
        }
      } finally {
        if (!shouldIgnore) {
          setIsLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      shouldIgnore = true;
    };
  }, [filters]);

  const chartMax = useMemo(
    () =>
      Math.max(
        1,
        ...analytics.cashflow.flatMap((item) => [item.income, item.expense]),
      ),
    [analytics.cashflow],
  );
  const categoryTotal = useMemo(
    () =>
      analytics.expensesByCategory.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      ),
    [analytics.expensesByCategory],
  );
  const tagTotal = useMemo(
    () =>
      analytics.expensesByTag.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      ),
    [analytics.expensesByTag],
  );
  const categoryChartData = useMemo(
    () =>
      analytics.expensesByCategory
        .filter((item) => Number(item.amount) > 0)
        .map((item, index) => ({
          ...item,
          color: chartColors[index % chartColors.length],
        })),
    [analytics.expensesByCategory],
  );
  const tagChartData = useMemo(
    () =>
      analytics.expensesByTag.map((item, index) => ({
        ...item,
        color: chartColors[index % chartColors.length],
      })),
    [analytics.expensesByTag],
  );
  const hasData =
    analytics.totalIncome > 0 ||
    analytics.totalExpense > 0 ||
    analytics.topExpenses.length > 0;

  const metrics = [
    {
      label: "Доходи",
      value: analytics.totalIncome,
      icon: ArrowUpRight,
      tone: "success",
    },
    {
      label: "Витрати",
      value: analytics.totalExpense,
      icon: ArrowDownLeft,
      tone: "danger",
    },
    {
      label: "Результат",
      value: analytics.financialResult,
      icon: CircleDollarSign,
      tone: analytics.financialResult >= 0 ? "success" : "danger",
    },
    {
      label: "Середні витрати / день",
      value: analytics.averageDailyExpense,
      icon: TrendingUp,
      tone: "amber",
    },
  ];

  const handlePeriodChange = (period) => {
    setFilters((current) => ({
      ...current,
      period,
      ...(period !== "custom" ? { dateFrom: "", dateTo: "" } : {}),
    }));
  };

  const handleDateChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
      period: "custom",
    }));
  };

  return (
    <main className="content-page">
      <section className="content-header analytics-header">
        <div>
          <span className="eyebrow">Аналітика</span>
          <h1>Фінансова картина за період</h1>
          <p>
            Дивіться структуру витрат, динаміку доходів і витрат та найбільші
            списання по активних рахунках
          </p>
        </div>

        <div className="analytics-period-panel">
          <div className="period-switcher">
            {periodOptions.map((option) => (
              <button
                className={
                  filters.period === option.value
                    ? "period-button active"
                    : "period-button"
                }
                key={option.value}
                onClick={() => handlePeriodChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          {filters.period === "custom" ? (
            <div className="analytics-date-range">
              <label>
                <span>Від</span>
                <input
                  name="dateFrom"
                  onChange={handleDateChange}
                  type="date"
                  value={filters.dateFrom}
                />
              </label>
              <label>
                <span>До</span>
                <input
                  name="dateTo"
                  onChange={handleDateChange}
                  type="date"
                  value={filters.dateTo}
                />
              </label>
            </div>
          ) : null}
        </div>
      </section>

      {error ? <p className="form-error dashboard-error">{error}</p> : null}

      {isLoading ? (
        <section className="dashboard-loading">
          <CalendarRange size={22} aria-hidden="true" />
          Завантажуємо аналітику...
        </section>
      ) : null}

      {!isLoading && !error && !hasData ? (
        <section className="dashboard-empty">
          <PieChart size={28} aria-hidden="true" />
          <h2>За вибраний період даних немає</h2>
          <p>
            Змініть період або синхронізуйте активні рахунки, щоб побачити
            аналітику
          </p>
        </section>
      ) : null}

      {!isLoading && !error && hasData ? (
        <>
          <section className="analytics-meta-row">
            <span>
              {analytics.dateFrom && analytics.dateTo
                ? `${formatDate(analytics.dateFrom)} - ${formatDate(analytics.dateTo)}`
                : "Поточний період"}
            </span>
            <span>
              {analytics.activeAccountsCount} активних рахунків
            </span>
          </section>

          <section className="analytics-metrics-grid">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <article className={`status-card metric-card ${metric.tone}`} key={metric.label}>
                  <div className="metric-icon">
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <span>{metric.label}</span>
                  <strong>{formatMoney(metric.value, currency)}</strong>
                </article>
              );
            })}
          </section>

          <section className="analytics-chart-grid">
            <article className="dashboard-panel analytics-chart-card">
              <div className="panel-heading">
                <BarChart3 size={22} aria-hidden="true" />
                <div>
                  <span>Динаміка</span>
                  <h2>Доходи та витрати</h2>
                </div>
              </div>

              {analytics.cashflow.some((item) => item.income || item.expense) ? (
                <div className="analytics-bars-chart">
                  {analytics.cashflow.map((item) => (
                    <div className="analytics-chart-column" key={item.key}>
                      <div className="analytics-bars">
                        <span
                          className="analytics-bar income"
                          style={{ height: getBarHeight(item.income, chartMax) }}
                          title={`Доходи: ${formatMoney(item.income, currency)}`}
                        />
                        <span
                          className="analytics-bar expense"
                          style={{ height: getBarHeight(item.expense, chartMax) }}
                          title={`Витрати: ${formatMoney(item.expense, currency)}`}
                        />
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">За період руху коштів немає.</div>
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
            </article>

            <article className="dashboard-panel comparison-card">
              <div className="panel-heading">
                <CalendarRange size={22} aria-hidden="true" />
                <div>
                  <span>Порівняння</span>
                  <h2>Місяць до місяця</h2>
                </div>
              </div>

              <div className="comparison-list">
                <div>
                  <span>Поточний місяць</span>
                  <strong>{formatMoney(analytics.monthComparison.current.result, currency)}</strong>
                  <small>
                    Доходи {formatMoney(analytics.monthComparison.current.income, currency)}
                  </small>
                  <small>
                    Витрати {formatMoney(analytics.monthComparison.current.expense, currency)}
                  </small>
                </div>
                <div>
                  <span>Попередній місяць</span>
                  <strong>{formatMoney(analytics.monthComparison.previous.result, currency)}</strong>
                  <small>
                    Доходи {formatMoney(analytics.monthComparison.previous.income, currency)}
                  </small>
                  <small>
                    Витрати {formatMoney(analytics.monthComparison.previous.expense, currency)}
                  </small>
                </div>
              </div>
            </article>
          </section>

          <section className="analytics-breakdown-grid">
            <article className="dashboard-panel">
              <div className="panel-heading">
                <PieChart size={22} aria-hidden="true" />
                <div>
                  <span>Категорії</span>
                  <h2>Структура витрат</h2>
                </div>
              </div>

              <div className="analytics-donut-layout">
                {categoryChartData.length ? (
                  <>
                    <div className="analytics-donut-chart" aria-hidden="true">
                      <ResponsiveContainer width="100%" height={260}>
                        <RechartsPieChart>
                          <Pie
                            data={categoryChartData}
                            dataKey="amount"
                            innerRadius={64}
                            nameKey="name"
                            outerRadius={96}
                            paddingAngle={3}
                            stroke="#FFFFFF"
                            strokeWidth={4}
                            name="Сума"
                          >
                            {categoryChartData.map((entry) => (
                              <Cell fill={entry.color} key={entry.name} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [formatMoney(value, currency), "Сума"]}
                            labelFormatter={(label) => label}
                            wrapperStyle={{ zIndex: 20 }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      <div className="analytics-donut-center">
                        <span>Усього</span>
                        <strong>{formatMoney(categoryTotal, currency)}</strong>
                      </div>
                    </div>
                    <div className="chart-breakdown-legend">
                      {categoryChartData.map((category) => {
                        const percent = categoryTotal
                          ? Math.round((category.amount / categoryTotal) * 100)
                          : 0;

                        return (
                          <div key={category.name}>
                            <i style={{ background: category.color }} />
                            <span>{category.name}</span>
                            <strong>{percent}%</strong>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">Витрат за категоріями немає.</div>
                )}
              </div>
            </article>

            <article className="dashboard-panel">
              <div className="panel-heading">
                <Tags size={22} aria-hidden="true" />
                <div>
                  <span>Теги</span>
                  <h2>Сфери витрат</h2>
                </div>
              </div>

              <div className="analytics-tag-chart">
                {tagChartData.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={270}>
                      <BarChart
                        data={tagChartData}
                        layout="vertical"
                        margin={{ top: 6, right: 18, bottom: 6, left: 4 }}
                      >
                        <XAxis hide type="number" />
                        <YAxis
                          axisLine={false}
                          dataKey="name"
                          tickLine={false}
                          type="category"
                          width={86}
                        />
                        <Tooltip
                          formatter={(value) => [formatMoney(value, currency), "Сума"]}
                          wrapperStyle={{ zIndex: 20 }}
                        />
                        <Bar dataKey="amount" name="Сума" radius={[0, 12, 12, 0]}>
                          {tagChartData.map((entry) => (
                            <Cell fill={entry.color} key={entry.name} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="chart-breakdown-legend">
                      {tagChartData.map((tag) => {
                        const percent = tagTotal
                          ? Math.round((tag.amount / tagTotal) * 100)
                          : 0;

                        return (
                          <div key={tag.name}>
                            <i style={{ background: tag.color }} />
                            <span>{tag.name}</span>
                            <strong>{percent}%</strong>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">Витрат за тегами немає.</div>
                )}
              </div>
            </article>
          </section>

          <section className="dashboard-panel analytics-top-panel">
            <div className="panel-heading">
              <ArrowDownLeft size={22} aria-hidden="true" />
              <div>
                <span>Топ витрат</span>
                <h2>Найбільші списання</h2>
              </div>
            </div>

            {analytics.topExpenses.length ? (
              <div className="analytics-expense-list">
                {analytics.topExpenses.map((transaction) => (
                  <article className="analytics-expense-card" key={transaction.id}>
                    <div>
                      <strong>{transaction.description}</strong>
                      <span>
                        {formatDate(transaction.transactionDate)} ·{" "}
                        {transaction.categoryName || "Інше"} · {transaction.tagName || "Інше"}
                      </span>
                    </div>
                    <b>
                      {formatMoney(transaction.amount, transaction.currency)}
                      {transaction.wasConverted ? (
                        <small>
                          {formatMoney(
                            transaction.originalAmount,
                            transaction.originalCurrency,
                          )}
                        </small>
                      ) : null}
                    </b>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">Найбільших витрат за період немає.</div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

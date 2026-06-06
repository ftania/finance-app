import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/useAuth";

const initialForm = {
  categoryId: "",
  tagId: "",
  limitAmount: "",
  periodType: "month",
  isActive: true,
};

const periodLabels = {
  day: "День",
  week: "Тиждень",
  month: "Місяць",
  custom: "Власний період",
};

const statusConfig = {
  safe: {
    label: "У нормі",
    icon: CheckCircle2,
  },
  warning: {
    label: "Понад 80%",
    icon: AlertTriangle,
  },
  exceeded: {
    label: "Перевищено",
    icon: XCircle,
  },
};

const formatMoney = (amount, currency = "UAH") => {
  const value = new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(amount || 0));

  return currency === "UAH" ? value.replace("грн", "₴") : value;
};

const getProgressWidth = (percent) => `${Math.min(Math.max(Number(percent || 0), 0), 100)}%`;

export default function Limits() {
  const { user } = useAuth();
  const [limits, setLimits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const currency = user?.currency || "UAH";

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );

  const loadLimits = async () => {
    const { data } = await api.get("/limits");
    setLimits(data.limits || []);
  };

  useEffect(() => {
    let shouldIgnore = false;

    async function loadInitialData() {
      try {
        const [metaResponse, limitsResponse] = await Promise.all([
          api.get("/transactions/meta"),
          api.get("/limits"),
        ]);

        if (!shouldIgnore) {
          const nextCategories = metaResponse.data.categories || [];
          const nextTags = metaResponse.data.tags || [];
          setCategories(nextCategories);
          setTags(nextTags);
          setLimits(limitsResponse.data.limits || []);
          setForm((current) => ({
            ...current,
            categoryId:
              nextCategories.find(
                (category) => category.type === "expense" && category.name === "Інше",
              )?.id ||
              nextCategories.find((category) => category.type === "expense")?.id ||
              "",
          }));
        }
      } catch (requestError) {
        if (!shouldIgnore) {
          setError(
            requestError.response?.data?.message ||
              "Не вдалося завантажити ліміти",
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

  const resetForm = () => {
    setEditingId("");
    setForm((current) => ({
      ...initialForm,
      categoryId: current.categoryId,
    }));
  };

  const handleFormChange = (event) => {
    const { checked, name, type, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEdit = (limit) => {
    setMessage("");
    setError("");
    setEditingId(limit.id);
    setForm({
      categoryId: limit.categoryId,
      tagId: limit.tagId || "",
      limitAmount: String(limit.limitAmount),
      periodType: limit.periodType === "custom" ? "month" : limit.periodType,
      isActive: limit.isActive,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    const payload = {
      ...form,
      tagId: form.tagId || null,
      limitAmount: Number(form.limitAmount),
    };

    try {
      const { data } = editingId
        ? await api.patch(`/limits/${editingId}`, payload)
        : await api.post("/limits", payload);

      setMessage(data.message);
      await loadLimits();
      resetForm();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не вдалося зберегти ліміт");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (limitId) => {
    setError("");
    setMessage("");

    try {
      const { data } = await api.delete(`/limits/${limitId}`);
      setMessage(data.message);
      await loadLimits();

      if (editingId === limitId) {
        resetForm();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не вдалося видалити ліміт");
    }
  };

  return (
    <main className="content-page">
      <section className="content-header">
        <div>
          <span className="eyebrow">Ліміти</span>
          <h1>Контроль витрат</h1>
          <p>
            Створюйте бюджетні межі для категорій і стежте, скільки вже
            використано за період
          </p>
        </div>
        <div className="connection-status-card">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <span>Активні ліміти</span>
            <strong>{limits.filter((limit) => limit.isActive).length}</strong>
          </div>
        </div>
      </section>

      <section className="limits-layout">
        <aside className="limits-form-panel">
          <form className="limit-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              {editingId ? <Edit3 size={22} aria-hidden="true" /> : <Plus size={22} aria-hidden="true" />}
              <div>
                <span>{editingId ? "Редагування" : "Новий ліміт"}</span>
                <h2>{editingId ? "Оновити ліміт" : "Створити ліміт"}</h2>
              </div>
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            {message ? <p className="form-success">{message}</p> : null}

            <label className="field">
              <span>Категорія</span>
              <div className="input-wrap select-wrap">
                <select
                  name="categoryId"
                  onChange={handleFormChange}
                  required
                  value={form.categoryId}
                >
                  {expenseCategories.map((category) => (
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
                <select name="tagId" onChange={handleFormChange} value={form.tagId}>
                  <option value="">Усі теги</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="field">
              <span>Сума ліміту</span>
              <div className="input-wrap">
                <input
                  min="1"
                  name="limitAmount"
                  onChange={handleFormChange}
                  placeholder="Наприклад 5000"
                  required
                  step="0.01"
                  type="number"
                  value={form.limitAmount}
                />
              </div>
            </label>

            <label className="field">
              <span>Період</span>
              <div className="input-wrap select-wrap">
                <select name="periodType" onChange={handleFormChange} value={form.periodType}>
                  <option value="day">День</option>
                  <option value="week">Тиждень</option>
                  <option value="month">Місяць</option>
                </select>
              </div>
            </label>

            <label className="limit-active-toggle">
              <input
                checked={form.isActive}
                name="isActive"
                onChange={handleFormChange}
                type="checkbox"
              />
              <span>Ліміт активний</span>
            </label>

            <div className="limit-form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? "Зберігаємо..." : editingId ? "Оновити" : "Створити"}
              </button>
              {editingId ? (
                <button className="ghost-button" onClick={resetForm} type="button">
                  Скасувати
                </button>
              ) : null}
            </div>
          </form>
        </aside>

        <section className="limits-list-panel">
          {isLoading ? (
            <div className="dashboard-loading">
              <ShieldCheck size={22} aria-hidden="true" />
              Завантажуємо ліміти...
            </div>
          ) : limits.length ? (
            <div className="limit-card-grid">
              {limits.map((limit) => {
                const StatusIcon = statusConfig[limit.status]?.icon || CheckCircle2;
                const remainingIsNegative = Number(limit.remainingAmount) < 0;

                return (
                  <article
                    className={`limit-card ${limit.status} ${limit.isActive ? "" : "inactive"}`}
                    key={limit.id}
                  >
                    <div className="limit-card-header">
                      <div>
                        <span>{periodLabels[limit.periodType]}</span>
                        <h2>{limit.categoryName}</h2>
                        <small>{limit.tagName ? limit.tagName : "Усі теги"}</small>
                      </div>
                      <div className={`limit-status ${limit.status}`}>
                        <StatusIcon size={16} aria-hidden="true" />
                        {statusConfig[limit.status]?.label}
                      </div>
                    </div>

                    <div className="limit-money-row">
                      <div>
                        <span>Ліміт</span>
                        <strong>{formatMoney(limit.limitAmount, limit.currency || currency)}</strong>
                      </div>
                      <div>
                        <span>Витрачено</span>
                        <strong>{formatMoney(limit.usedAmount, limit.currency || currency)}</strong>
                      </div>
                      <div>
                        <span>Залишок</span>
                        <strong className={remainingIsNegative ? "negative" : ""}>
                          {formatMoney(limit.remainingAmount, limit.currency || currency)}
                        </strong>
                      </div>
                    </div>

                    <div className="limit-progress">
                      <span style={{ width: getProgressWidth(limit.usedPercent) }} />
                    </div>

                    {limit.status === "warning" ? (
                      <p className="limit-warning">Використано понад 80% ліміту</p>
                    ) : null}
                    {limit.status === "exceeded" ? (
                      <p className="limit-danger">Ліміт перевищено</p>
                    ) : null}

                    <div className="limit-card-actions">
                      <button className="ghost-button" onClick={() => handleEdit(limit)} type="button">
                        <Edit3 size={16} aria-hidden="true" />
                        Редагувати
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => handleDelete(limit.id)}
                        type="button"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        Видалити
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty">
              <ShieldCheck size={28} aria-hidden="true" />
              <h2>Лімітів ще немає</h2>
              <p>Створіть перший ліміт для категорії, щоб контролювати витрати</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

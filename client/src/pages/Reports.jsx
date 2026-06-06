import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const initialCsvFilters = {
  period: "month",
  dateFrom: "",
  dateTo: "",
  accountId: "",
  type: "",
  categoryId: "",
  tagId: "",
};

const initialPdfFilters = {
  period: "month",
  dateFrom: "",
  dateTo: "",
};

const periodOptions = [
  { label: "Сьогодні", value: "today" },
  { label: "Тиждень", value: "week" },
  { label: "Місяць", value: "month" },
  { label: "Рік", value: "year" },
  { label: "Власний", value: "custom" },
];

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const getFilename = (headers, fallback) => {
  const disposition = headers["content-disposition"];
  const match = disposition?.match(/filename="?(.*?)"?$/);
  return match?.[1] || fallback;
};

const isCustomRangeIncomplete = (filters) =>
  filters.period === "custom" && (!filters.dateFrom || !filters.dateTo);

const getTodayInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const todayInputValue = getTodayInputValue();

const hasFutureDate = (filters) =>
  [filters.dateFrom, filters.dateTo].some((date) => date && date > todayInputValue);

export default function Reports() {
  const [csvFilters, setCsvFilters] = useState(initialCsvFilters);
  const [pdfFilters, setPdfFilters] = useState(initialPdfFilters);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState("");

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );
  const isCsvRangeIncomplete = isCustomRangeIncomplete(csvFilters);
  const isPdfRangeIncomplete = isCustomRangeIncomplete(pdfFilters);
  const hasCsvFutureDate = hasFutureDate(csvFilters);
  const hasPdfFutureDate = hasFutureDate(pdfFilters);

  useEffect(() => {
    let shouldIgnore = false;

    async function loadMeta() {
      try {
        const { data } = await api.get("/transactions/meta");

        if (!shouldIgnore) {
          setCategories(data.categories || []);
          setTags(data.tags || []);
          setAccounts((data.accounts || []).filter((account) => account.isTracked));
        }
      } catch (requestError) {
        if (!shouldIgnore) {
          setError(
            requestError.response?.data?.message ||
              "Не вдалося завантажити фільтри",
          );
        }
      } finally {
        if (!shouldIgnore) {
          setIsLoading(false);
        }
      }
    }

    loadMeta();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  const buildParams = (filters) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    return params;
  };

  const handleCsvFilterChange = (event) => {
    const { name, value } = event.target;
    setCsvFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === "type" ? { categoryId: "" } : {}),
      ...(name === "period" && value !== "custom" ? { dateFrom: "", dateTo: "" } : {}),
      ...(name === "dateFrom" || name === "dateTo" ? { period: "custom" } : {}),
    }));
  };

  const handlePdfFilterChange = (event) => {
    const { name, value } = event.target;
    setPdfFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === "period" && value !== "custom" ? { dateFrom: "", dateTo: "" } : {}),
      ...(name === "dateFrom" || name === "dateTo" ? { period: "custom" } : {}),
    }));
  };

  const handleDownloadCsv = async () => {
    setError("");

    if (isCsvRangeIncomplete) {
      setError("Оберіть дату початку і завершення для власного періоду");
      return;
    }

    if (hasCsvFutureDate) {
      setError("Не можна обрати дату з майбутнього");
      return;
    }

    setDownloading("csv");

    try {
      const params = buildParams(csvFilters);
      const response = await api.get(`/reports/transactions.csv?${params.toString()}`, {
        responseType: "blob",
      });

      downloadBlob(response.data, getFilename(response.headers, "transactions.csv"));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не вдалося завантажити CSV");
    } finally {
      setDownloading("");
    }
  };

  const handleDownloadPdf = async () => {
    setError("");

    if (isPdfRangeIncomplete) {
      setError("Оберіть дату початку і завершення для власного періоду");
      return;
    }

    if (hasPdfFutureDate) {
      setError("Не можна обрати дату з майбутнього");
      return;
    }

    setDownloading("pdf");

    try {
      const params = buildParams(pdfFilters);
      const response = await api.get(`/reports/financial.pdf?${params.toString()}`, {
        responseType: "blob",
      });

      downloadBlob(response.data, getFilename(response.headers, "financial-report.pdf"));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не вдалося завантажити PDF");
    } finally {
      setDownloading("");
    }
  };

  return (
    <main className="content-page">
      <section className="content-header">
        <div>
          <span className="eyebrow">Звіти / Експорт</span>
          <h1>Файли для аналізу</h1>
          <p>
            Завантажуйте транзакції у CSV або сформуйте фінансовий PDF-звіт за
            вибраний період
          </p>
        </div>
        <div className="connection-status-card">
          <Download size={22} aria-hidden="true" />
          <div>
            <span>Експорт</span>
            <strong>CSV та PDF</strong>
          </div>
        </div>
      </section>

      {error ? <p className="form-error dashboard-error">{error}</p> : null}

      {isLoading ? (
        <section className="dashboard-loading">
          <CalendarRange size={22} aria-hidden="true" />
          Завантажуємо параметри експорту...
        </section>
      ) : null}

      {!isLoading ? (
        <section className="reports-grid">
          <article className="report-card">
            <div className="panel-heading">
              <FileSpreadsheet size={22} aria-hidden="true" />
              <div>
                <span>Експорт транзакцій</span>
                <h2>Завантажити CSV</h2>
              </div>
            </div>

            <div className="report-filter-grid">
              <label className="field">
                <span>Період</span>
                <div className="input-wrap select-wrap">
                  <select name="period" onChange={handleCsvFilterChange} value={csvFilters.period}>
                    {periodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Рахунок</span>
                <div className="input-wrap select-wrap">
                  <select name="accountId" onChange={handleCsvFilterChange} value={csvFilters.accountId}>
                    <option value="">Усі рахунки</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Тип</span>
                <div className="input-wrap select-wrap">
                  <select name="type" onChange={handleCsvFilterChange} value={csvFilters.type}>
                    <option value="">Усі</option>
                    <option value="income">Доходи</option>
                    <option value="expense">Витрати</option>
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Категорія</span>
                <div className="input-wrap select-wrap">
                  <select
                    name="categoryId"
                    onChange={handleCsvFilterChange}
                    value={csvFilters.categoryId}
                  >
                    <option value="">Усі категорії</option>
                    {(csvFilters.type === "income" ? categories.filter((item) => item.type === "income") : expenseCategories).map((category) => (
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
                  <select name="tagId" onChange={handleCsvFilterChange} value={csvFilters.tagId}>
                    <option value="">Усі теги</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              {csvFilters.period === "custom" ? (
                <>
                  <label className="field">
                    <span>Від</span>
                    <div className="input-wrap">
                      <input
                        max={todayInputValue}
                        name="dateFrom"
                        onChange={handleCsvFilterChange}
                        type="date"
                        value={csvFilters.dateFrom}
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span>До</span>
                    <div className="input-wrap">
                      <input
                        max={todayInputValue}
                        name="dateTo"
                        onChange={handleCsvFilterChange}
                        type="date"
                        value={csvFilters.dateTo}
                      />
                    </div>
                  </label>
                </>
              ) : null}
            </div>

            {isCsvRangeIncomplete ? (
              <p className="report-validation-note">
                Для власного періоду оберіть дату початку і завершення
              </p>
            ) : null}
            {hasCsvFutureDate ? (
              <p className="report-validation-note">
                Не можна обрати дату з майбутнього
              </p>
            ) : null}

            <button
              className="primary-button"
              disabled={downloading === "csv" || isCsvRangeIncomplete || hasCsvFutureDate}
              onClick={handleDownloadCsv}
              type="button"
            >
              <Download size={18} aria-hidden="true" />
              {downloading === "csv" ? "Готуємо CSV..." : "Завантажити CSV"}
            </button>
          </article>

          <article className="report-card report-card-accent">
            <div className="panel-heading">
              <FileText size={22} aria-hidden="true" />
              <div>
                <span>Фінансовий звіт</span>
                <h2>Завантажити PDF</h2>
              </div>
            </div>

            <div className="report-filter-grid compact">
              <label className="field">
                <span>Період</span>
                <div className="input-wrap select-wrap">
                  <select name="period" onChange={handlePdfFilterChange} value={pdfFilters.period}>
                    {periodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              {pdfFilters.period === "custom" ? (
                <>
                  <label className="field">
                    <span>Від</span>
                    <div className="input-wrap">
                      <input
                        max={todayInputValue}
                        name="dateFrom"
                        onChange={handlePdfFilterChange}
                        type="date"
                        value={pdfFilters.dateFrom}
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span>До</span>
                    <div className="input-wrap">
                      <input
                        max={todayInputValue}
                        name="dateTo"
                        onChange={handlePdfFilterChange}
                        type="date"
                        value={pdfFilters.dateTo}
                      />
                    </div>
                  </label>
                </>
              ) : null}
            </div>

            {isPdfRangeIncomplete ? (
              <p className="report-validation-note">
                Для власного періоду оберіть дату початку і завершення
              </p>
            ) : null}
            {hasPdfFutureDate ? (
              <p className="report-validation-note">
                Не можна обрати дату з майбутнього
              </p>
            ) : null}

            <div className="report-summary-note">
              <SlidersHorizontal size={18} aria-hidden="true" />
              <span>PDF містить підсумки, категорії, теги, топ витрат і стан лімітів</span>
            </div>

            <button
              className="primary-button"
              disabled={downloading === "pdf" || isPdfRangeIncomplete || hasPdfFutureDate}
              onClick={handleDownloadPdf}
              type="button"
            >
              <Download size={18} aria-hidden="true" />
              {downloading === "pdf" ? "Готуємо PDF..." : "Завантажити PDF"}
            </button>
          </article>
        </section>
      ) : null}
    </main>
  );
}

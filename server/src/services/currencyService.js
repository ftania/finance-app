const NBU_EXCHANGE_URL =
  'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json';
const SUPPORTED_CURRENCIES = ['UAH', 'USD', 'EUR'];
const CACHE_TTL_MS = 60 * 60 * 1000;
const FALLBACK_RATE = 44;

let cachedRates = null;

const normalizeCurrency = (currency) => {
  const normalized = String(currency || 'UAH').toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized) ? normalized : 'UAH';
};

const getNbuExchangeRates = async () => {
  if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(NBU_EXCHANGE_URL, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Не вдалося отримати курс НБУ');
    }

    const data = await response.json();
    const rates = data.reduce(
      (result, item) => {
        if (SUPPORTED_CURRENCIES.includes(item.cc)) {
          result[item.cc] = Number(item.rate);
        }

        return result;
      },
      { UAH: 1 },
    );

    for (const currency of SUPPORTED_CURRENCIES) {
      if (!rates[currency]) {
        throw new Error(`НБУ не повернув курс ${currency}`);
      }
    }

    cachedRates = {
      fetchedAt: Date.now(),
      rateDate: data.find((item) => item.cc === 'USD')?.exchangedate || null,
      rates,
    };

    return cachedRates;
  } catch (error) {
    if (cachedRates) {
      return cachedRates;
    }

    return {
      fetchedAt: Date.now(),
      rateDate: null,
      isFallback: true,
      rates: {
        UAH: 1,
        USD: FALLBACK_RATE,
        EUR: FALLBACK_RATE,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
};

const convertCurrency = (amount, fromCurrency, toCurrency, exchangeRates) => {
  const sourceCurrency = normalizeCurrency(fromCurrency);
  const targetCurrency = normalizeCurrency(toCurrency);
  const value = Number(amount || 0);

  if (sourceCurrency === targetCurrency) {
    return Number(value.toFixed(2));
  }

  const sourceRate = exchangeRates.rates[sourceCurrency];
  const targetRate = exchangeRates.rates[targetCurrency];

  if (!sourceRate || !targetRate) {
    throw new Error('Курс для валюти не знайдено');
  }

  const amountInUah = value * sourceRate;
  return Number((amountInUah / targetRate).toFixed(2));
};

module.exports = {
  convertCurrency,
  getNbuExchangeRates,
  normalizeCurrency,
};

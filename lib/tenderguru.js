const PARAMS = require('../config/params');
const { normalizeItem, extractList } = require('./normalize');

const BASE_HOST = 'https://www.tenderguru.ru';
const REQUEST_TIMEOUT_MS = 20000;

class TenderGuruError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TenderGuruError';
    this.code = code || 'TENDERGURU_ERROR';
  }
}

// Область поиска определяет не параметр, а сам путь запроса (см. config/params.js).
// ОКПД2 фильтруется только на /export/products через сегменты d1..d4, поэтому
// наличие кода ОКПД2 переопределяет выбранную пользователем область поиска.
function resolveEndpoint(filters) {
  if (filters.okpd) return PARAMS.ENDPOINTS.product;
  return PARAMS.ENDPOINTS[filters.kwordsWhere] || PARAMS.ENDPOINTS.everywhere;
}

function buildLawParam(filters) {
  if (Array.isArray(filters.laws) && filters.laws.length) {
    const mapped = filters.laws.map((code) => PARAMS.LAW_VALUES[code]).filter(Boolean);
    if (mapped.length) return mapped.join(',');
  }
  if (filters.customerType === 'state') {
    return PARAMS.CUSTOMER_TYPE_STATE_LAWS.join(',');
  }
  return null;
}

function buildQuery(filters) {
  const apiCode = process.env.TENDERGURU_API_KEY;
  const refreshCode = process.env.TENDERGURU_REFRESH_KEY;

  if (!apiCode) {
    throw new TenderGuruError(
      'Не задана переменная окружения TENDERGURU_API_KEY на сервере.',
      'MISSING_API_KEY'
    );
  }

  const qs = new URLSearchParams();
  qs.set(PARAMS.dtype, 'json');
  qs.set(PARAMS.apiCode, apiCode);
  if (refreshCode) qs.set(PARAMS.refreshCode, refreshCode);

  if (filters.kwords) qs.set(PARAMS.keywords, filters.kwords);

  if (filters.okpd) {
    const segments = String(filters.okpd).split('.').map((s) => s.trim()).filter(Boolean);
    segments.slice(0, PARAMS.okpdSegments.length).forEach((value, i) => {
      qs.set(PARAMS.okpdSegments[i], value);
    });
  }

  const lawParam = buildLawParam(filters);
  if (lawParam) qs.set(PARAMS.law, lawParam);

  if (Array.isArray(filters.regions)) {
    filters.regions.forEach((id) => qs.set(`${PARAMS.regionPrefix}${id}`, '1'));
  }
  if (Array.isArray(filters.sections)) {
    filters.sections.forEach((id) => qs.set(`${PARAMS.sectionPrefix}${id}`, '1'));
  }
  if (filters.etp) {
    qs.set(`${PARAMS.etpPrefix}${filters.etp}`, '1');
  }

  if (filters.priceFrom) qs.set(PARAMS.priceFrom, filters.priceFrom);
  if (filters.priceTo) qs.set(PARAMS.priceTo, filters.priceTo);
  if (filters.dateFrom) qs.set(PARAMS.dateFrom, filters.dateFrom);
  if (filters.dateTo) qs.set(PARAMS.dateTo, filters.dateTo);

  qs.set(PARAMS.page, String(filters.page || 1));

  return qs;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchTenders(filters) {
  const qs = buildQuery(filters);
  const endpoint = resolveEndpoint(filters);
  const url = `${BASE_HOST}${endpoint}?${qs.toString()}`;

  let response;
  try {
    response = await fetchWithTimeout(url);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new TenderGuruError('Превышено время ожидания ответа от TenderGuru.', 'TIMEOUT');
    }
    throw new TenderGuruError(`Не удалось обратиться к TenderGuru: ${err.message}`, 'NETWORK_ERROR');
  }

  const rawText = await response.text();
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new TenderGuruError(
      'TenderGuru вернул ответ не в формате JSON (возможно, изменилась структура API или неверный ключ).',
      'BAD_RESPONSE'
    );
  }

  if (!response.ok) {
    throw new TenderGuruError(
      pick_error(payload) || `TenderGuru вернул ошибку HTTP ${response.status}.`,
      'HTTP_ERROR'
    );
  }

  const errorMessage = pick_error(payload);
  if (errorMessage) {
    throw new TenderGuruError(errorMessage, classifyError(errorMessage));
  }

  const { items, total } = extractList(payload);
  const normalized = items.map(normalizeItem);
  const page = filters.page || 1;
  // Реальный размер страницы TenderGuru не документирован явно и не управляется
  // отдельным параметром — берём фактическое число записей на этой странице.
  const actualPageSize = normalized.length;

  return {
    items: normalized,
    page,
    onPage: actualPageSize,
    total,
    hasMore: actualPageSize > 0 && page * actualPageSize < total,
  };
}

// TODO: формат ошибок TenderGuru не описан явно в документации отдельной таблицей;
// поправьте при первом реальном сообщении об ошибке (неверный ключ, лимит и т.д.).
function pick_error(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error && typeof payload.error.message === 'string') return payload.error.message;
  if (typeof payload.error_text === 'string') return payload.error_text;
  if (typeof payload.message === 'string' && payload.status === 'error') return payload.message;
  return null;
}

function classifyError(message) {
  const lower = message.toLowerCase();
  if (lower.includes('ключ') || lower.includes('key') || lower.includes('код')) return 'INVALID_KEY';
  if (lower.includes('лимит') || lower.includes('limit')) return 'LIMIT_EXCEEDED';
  return 'TENDERGURU_ERROR';
}

module.exports = { searchTenders, TenderGuruError };

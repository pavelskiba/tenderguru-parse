const PARAMS = require('../config/params');
const { normalizeItem, extractList } = require('./normalize');

const BASE_URL = 'https://www.tenderguru.ru/api2.3/export';
const ON_PAGE_DEFAULT = 50;
const REQUEST_TIMEOUT_MS = 20000;

class TenderGuruError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TenderGuruError';
    this.code = code || 'TENDERGURU_ERROR';
  }
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
  if (filters.kwordsWhere) qs.set(PARAMS.keywordsScope, filters.kwordsWhere);
  if (filters.okpd) qs.set(PARAMS.okpd, filters.okpd);

  if (Array.isArray(filters.regions) && filters.regions.length) {
    qs.set(PARAMS.region, filters.regions.join(','));
  }
  if (Array.isArray(filters.sections) && filters.sections.length) {
    qs.set(PARAMS.section, filters.sections.join(','));
  }
  if (Array.isArray(filters.laws) && filters.laws.length) {
    qs.set(PARAMS.law, filters.laws.join(','));
  }
  if (filters.customerType) qs.set(PARAMS.customerType, filters.customerType);
  if (filters.etp) qs.set(PARAMS.etp, filters.etp);

  if (filters.priceFrom) qs.set(PARAMS.priceFrom, filters.priceFrom);
  if (filters.priceTo) qs.set(PARAMS.priceTo, filters.priceTo);
  if (filters.dateFrom) qs.set(PARAMS.dateFrom, filters.dateFrom);
  if (filters.dateTo) qs.set(PARAMS.dateTo, filters.dateTo);

  qs.set(PARAMS.page, String(filters.page || 1));
  qs.set(PARAMS.onPage, String(filters.onPage || ON_PAGE_DEFAULT));

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
  const url = `${BASE_URL}?${qs.toString()}`;

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
  // TenderGuru отдаёт фиксированный размер страницы независимо от запрошенного
  // on_page (см. README/TODO в config/params.js), поэтому для hasMore берём
  // фактическое число записей на этой странице, а не запрошенное.
  const actualPageSize = normalized.length;

  return {
    items: normalized,
    page,
    onPage: actualPageSize,
    total,
    hasMore: actualPageSize > 0 && page * actualPageSize < total,
  };
}

// TODO: поправьте под реальный формат ошибок TenderGuru после сверки с документацией.
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

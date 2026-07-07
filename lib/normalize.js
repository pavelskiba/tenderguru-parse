/**
 * Приведение "сырого" ответа TenderGuru к единому формату для фронта.
 *
 * Точная схема полей JSON-ответа TenderGuru не была проверена вживую
 * (документация недоступна для автоматической загрузки — см. README).
 * Чтобы приложение не разваливалось при небольших расхождениях в
 * названиях полей, для каждого выходного поля перебирается список
 * вероятных ключей (candidates). Если реальные названия окажутся другими —
 * достаточно дописать их в соответствующий массив ниже.
 */

function pick(obj, candidates) {
  for (const key of candidates) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return null;
}

function normalizeItem(raw) {
  return {
    title: pick(raw, ['tTitle', 'title', 'name', 'subject', 'tName', 'trade_name']),
    number: pick(raw, ['tNumber', 'number', 'trade_number', 'reg_number', 'notice_number']),
    customer: pick(raw, ['tCustomer', 'customer', 'zakazchik', 'organizer', 'customer_name']),
    region: pick(raw, ['tRegion', 'region', 'region_name']),
    price: pick(raw, ['tPrice', 'price', 'nmck', 'start_price', 'sum']),
    deadline: pick(raw, ['tEndDate', 'end_date', 'd_end', 'deadline', 'submission_end_date']),
    law: pick(raw, ['tFZ', 'zakon', 'law', 'fz']),
    url: pick(raw, ['tLink', 'link', 'url', 'source_url', 'href']),
    raw,
  };
}

/**
 * Пытается извлечь массив тендеров и метаданные пагинации из ответа
 * произвольной формы (объект, массив, объект вида {tenders:[...]}, и т.п.).
 */
function extractList(payload) {
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length };
  }

  if (payload && typeof payload === 'object') {
    const listKey = ['tenders', 'data', 'items', 'result', 'trades', 'list'].find(
      (key) => Array.isArray(payload[key])
    );
    if (listKey) {
      const total = pick(payload, ['total', 'count', 'total_count', 'found']) ?? payload[listKey].length;
      return { items: payload[listKey], total: Number(total) || payload[listKey].length };
    }

    // Легаси-формат: объект, где значения — сами записи тендеров
    const values = Object.values(payload).filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (values.length) {
      return { items: values, total: values.length };
    }
  }

  return { items: [], total: 0 };
}

module.exports = { normalizeItem, extractList };

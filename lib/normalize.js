/**
 * Приведение "сырого" ответа TenderGuru к единому формату для фронта.
 *
 * Схема подтверждена реальным запросом к api2.3/export (dtype=json):
 * ответ — JSON-массив, где первый элемент служебный {"Total": "N"}
 * (общее число тендеров, подходящих под фильтр), а остальные элементы —
 * сами тендеры с полями TenderName/Customer/Category/Region/Price/
 * EndTime/Fz/TenderLinkInner/TenderNumOuter/ID.
 *
 * На бесплатном/базовом тарифе поля Customer, Etp и TenderLink приходят
 * как текст-заглушка "Только для подписчиков портала: ..." — это не
 * ошибка кода, а ограничение тарифа TenderGuru. Ссылка на источник
 * поэтому берётся из TenderLinkInner (она рабочая на любом тарифе).
 *
 * Список candidates для каждого поля оставлен с запасными вариантами
 * названий на случай изменений в API — реальные поля стоят первыми.
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
    title: pick(raw, ['TenderName', 'tTitle', 'title', 'name', 'subject', 'tName', 'trade_name']),
    number: pick(raw, ['TenderNumOuter', 'tNumber', 'number', 'trade_number', 'reg_number', 'notice_number', 'ID']),
    customer: pick(raw, ['Customer', 'tCustomer', 'customer', 'zakazchik', 'organizer', 'customer_name']),
    region: pick(raw, ['Region', 'tRegion', 'region', 'region_name']),
    price: pick(raw, ['Price', 'tPrice', 'price', 'nmck', 'start_price', 'sum']),
    deadline: pick(raw, ['EndTime', 'tEndDate', 'end_date', 'd_end', 'deadline', 'submission_end_date']),
    law: pick(raw, ['Fz', 'tFZ', 'zakon', 'law', 'fz']),
    url: pick(raw, ['TenderLinkInner', 'tLink', 'link', 'url', 'source_url', 'href']),
    raw,
  };
}

function isTotalMeta(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  const keys = Object.keys(entry);
  return keys.length === 1 && keys[0] === 'Total';
}

/**
 * Извлекает массив тендеров и общее число найденных из ответа TenderGuru.
 * Основной случай — массив с одним служебным {"Total": "N"} элементом.
 * Дополнительные ветки оставлены на случай изменения формата ответа.
 */
function extractList(payload) {
  if (Array.isArray(payload)) {
    let total = null;
    const items = [];
    for (const entry of payload) {
      if (isTotalMeta(entry)) {
        total = Number(entry.Total) || 0;
        continue;
      }
      items.push(entry);
    }
    return { items, total: total !== null ? total : items.length };
  }

  if (payload && typeof payload === 'object') {
    const listKey = ['tenders', 'data', 'items', 'result', 'trades', 'list'].find(
      (key) => Array.isArray(payload[key])
    );
    if (listKey) {
      const rawList = payload[listKey];
      const totalMeta = rawList.find(isTotalMeta);
      const items = rawList.filter((entry) => !isTotalMeta(entry));
      const total = totalMeta
        ? Number(totalMeta.Total) || 0
        : Number(pick(payload, ['total', 'count', 'total_count', 'found'])) || items.length;
      return { items, total };
    }

    // Легаси-формат: объект, где значения — сами записи тендеров
    const values = Object.values(payload).filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (values.length) {
      const totalMeta = values.find(isTotalMeta);
      const items = values.filter((entry) => !isTotalMeta(entry));
      return { items, total: totalMeta ? Number(totalMeta.Total) || 0 : items.length };
    }
  }

  return { items: [], total: 0 };
}

module.exports = { normalizeItem, extractList };

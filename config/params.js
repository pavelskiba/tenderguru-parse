/**
 * Единая точка соответствия наших фильтров и параметров TenderGuru API.
 *
 * ВАЖНО: сайт tenderguru.ru блокирует автоматическую загрузку своей
 * документации (https://www.tenderguru.ru/api/documentation) для ботов,
 * поэтому часть имён параметров ниже — это общепринятые в API TenderGuru
 * названия, но НЕ ПРОВЕРЕННЫЕ вживую в момент написания кода.
 * Параметры, которые указал сам заказчик (kwords, dtype, api_code,
 * refresh_key) — совпадают с реальным API.
 *
 * Перед деплоем откройте https://www.tenderguru.ru/api/documentation
 * (раздел "export", режим dtype=json) и поправьте значения справа от
 * двоеточия на реальные имена параметров — это единственное место,
 * которое нужно менять.
 */

module.exports = {
  // подтверждено заказчиком / документацией
  dtype: 'dtype',
  keywords: 'kwords',
  apiCode: 'api_code',
  refreshCode: 'refresh_key',
  page: 'page',

  // TODO: сверить с https://www.tenderguru.ru/api/documentation
  keywordsScope: 'kwords_where', // область поиска: значения ниже в KWORDS_SCOPE_VALUES
  region: 'region', // регионы, через запятую
  section: 'razdel', // разделы (рубрики), через запятую
  law: 'zakon', // 44 / 223 / kom
  customerType: 'customer_type', // государственный / любой
  etp: 'etp', // электронная площадка
  priceFrom: 'price_from',
  priceTo: 'price_to',
  dateFrom: 'date_from', // дата размещения "от", формат dd.mm.yyyy
  dateTo: 'date_to', // дата размещения "до"
  okpd: 'okpd', // код ОКПД2
  onPage: 'on_page', // количество тендеров на странице
};

// TODO: сверить допустимые значения области поиска с документацией
module.exports.KWORDS_SCOPE_VALUES = {
  everywhere: 'all',
  title: 'title',
  docs: 'docs',
  product: 'product',
};

// TODO: сверить обозначения закона с документацией (возможно 44fz/223fz/commercial)
module.exports.LAW_VALUES = {
  '44fz': '44',
  '223fz': '223',
  commercial: 'kom',
};

// TODO: сверить значение для "только государственный заказчик"
module.exports.CUSTOMER_TYPE_VALUES = {
  any: '',
  state: 'gos',
};

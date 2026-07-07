/**
 * Соответствие наших фильтров и параметров TenderGuru API2.3.
 *
 * Подтверждено официальной документацией (https://www.tenderguru.ru/api/documentation,
 * раздел "Список закупок (Россия)") и прямыми тестовыми запросами к API:
 *
 *   kwords          — ключевые слова (полнотекстовый поиск)
 *   kwords_minus     — исключить слова (не используется в этом приложении)
 *   f                — закон: 44 / 223 / kom
 *   r{ID}=1          — регион, ID берётся из справочника regions (config/regions.js)
 *   c{ID}=1          — раздел/категория, ID из справочника cat (config/sections.js)
 *   e{ID}=1          — электронная площадка, ID из справочника eauc (config/etp.js)
 *   price1 / price2  — цена контракта от/до
 *   date_start / date_end — дата размещения от/до, формат дд.мм.гггг
 *   page             — номер страницы (платная функция)
 *   dtype            — формат ответа (json)
 *   api_code         — токен доступа
 *
 * ВАЖНО про "область поиска" (везде/заголовок/документация/продукция):
 * прямого параметра-переключателя для основного метода /export нет.
 * В документации это отдельные точки входа:
 *   /api2.3/export               — обычный поиск по тендерам (везде/заголовок)
 *   /api2.3/export/documentation — поиск по тексту документации закупки
 *   /api2.3/export/products      — поиск в разрезе продукции (кроме kwords,
 *                                   поддерживает структуру ОКПД2 через d1..d4)
 * Поэтому переключение "области поиска" в этом приложении меняет не параметр,
 * а сам путь запроса — см. lib/tenderguru.js (buildRequest).
 *
 * ОКПД2 фильтруется через параметры d1/d2/d3/d4 (сегменты кода через точку)
 * на эндпоинте /export/products, а не через отдельный параметр "okpd".
 */

module.exports = {
  dtype: 'dtype',
  keywords: 'kwords',
  apiCode: 'api_code',
  refreshCode: 'refresh_key',
  page: 'page',

  law: 'f', // значения: 44 / 223 / kom (см. LAW_VALUES)
  regionPrefix: 'r', // r{ID}=1
  sectionPrefix: 'c', // c{ID}=1
  etpPrefix: 'e', // e{ID}=1

  priceFrom: 'price1',
  priceTo: 'price2',
  dateFrom: 'date_start',
  dateTo: 'date_end',

  // сегменты кода ОКПД2 для /export/products
  okpdSegments: ['d1', 'd2', 'd3', 'd4'],
};

module.exports.LAW_VALUES = {
  '44fz': '44',
  '223fz': '223',
  commercial: 'kom',
};

// TODO: в документации нет отдельного параметра "тип заказчика".
// Практическое приближение: "Государственный" транслируется в f=44,223
// (если пользователь не выбрал закон явно чекбоксами) — см. lib/tenderguru.js.
module.exports.CUSTOMER_TYPE_STATE_LAWS = ['44', '223'];

// Базовые пути API для разных "областей поиска".
module.exports.ENDPOINTS = {
  everywhere: '/api2.3/export',
  title: '/api2.3/export', // отдельного режима "только заголовок" в документации нет
  docs: '/api2.3/export/documentation',
  product: '/api2.3/export/products',
};

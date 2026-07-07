# Поиск тендеров (TenderGuru API)

Веб-приложение для поиска тендеров через API TenderGuru. Node.js + Express
отдаёт статический фронтенд (обычный HTML/CSS/JS) и проксирует запросы к
`https://www.tenderguru.ru/api2.3/export`, скрывая ключи API от клиента.

## ⚠️ Обязательно перед деплоем

Автоматическая загрузка документации TenderGuru
(https://www.tenderguru.ru/api/documentation) была недоступна на момент
написания кода (сайт блокирует запросы ботов, HTTP 403). Поэтому часть
названий параметров запроса и полей ответа — это общепринятые для
TenderGuru имена, **не проверенные вживую**.

Перед первым реальным запуском:

1. Откройте https://www.tenderguru.ru/api/documentation и раздел про метод
   `export` (режим `dtype=json`) — там точные названия параметров по
   каждому режиму фильтрации.
2. Сверьте и при необходимости поправьте:
   - `config/params.js` — имена query-параметров (регион, раздел, закон,
     тип заказчика, ЭТП, цена, даты, пагинация, область поиска по ключевым
     словам) и допустимые значения (`LAW_VALUES`, `CUSTOMER_TYPE_VALUES`,
     `KWORDS_SCOPE_VALUES`).
   - `lib/normalize.js` — какие ключи реально приходят в JSON-ответе для
     названия, номера, заказчика, региона, цены, даты и ссылки (сейчас
     код перебирает несколько вероятных вариантов названий полей).
   - `lib/tenderguru.js`, функция `pick_error` — реальный формат сообщений
     об ошибках (неверный ключ, лимит запросов и т.д.).
   - `config/regions.js`, `config/sections.js`, `config/etp.js` — при
     необходимости замените названия на точные значения/коды, которые
     принимает API.

Все эти правки локализованы в паре файлов — менять фронтенд не нужно.

## Стек

- Backend: Node.js + Express
- Frontend: статический HTML/CSS/JS в `public/` (без сборки)
- Один сервис, один `package.json` — годится для деплоя на Railway как
  единое приложение.

## Локальный запуск

```bash
npm install
cp .env.example .env
# впишите в .env свои TENDERGURU_API_KEY и TENDERGURU_REFRESH_KEY
npm start
```

Приложение слушает `process.env.PORT` (по умолчанию `3000`), откройте
http://localhost:3000.

## Переменные окружения

| Переменная                | Назначение                                   |
|----------------------------|-----------------------------------------------|
| `TENDERGURU_API_KEY`       | `api_code` — ключ доступа к API TenderGuru    |
| `TENDERGURU_REFRESH_KEY`   | `refresh_key` — код обновления/продления ключа |
| `PORT`                     | Порт сервера (на Railway задаётся автоматически) |

Ключи **никогда** не хардкодятся в коде и не уходят на клиент — они
используются только в `lib/tenderguru.js` на сервере при формировании
запроса к TenderGuru.

## Деплой на Railway

1. Запушьте проект в GitHub-репозиторий (файл `.env` не попадёт в git —
   он в `.gitignore`; `.env.example` используется только как шаблон).
2. В Railway создайте новый проект → Deploy from GitHub repo.
3. Railway определит Node.js-проект (есть `package.json` со скриптом
   `start`, `Procfile` и `railway.json` для Nixpacks) и соберёт его
   автоматически.
4. В настройках проекта на Railway откройте **Variables** и добавьте:
   - `TENDERGURU_API_KEY` = ваш реальный api_code
   - `TENDERGURU_REFRESH_KEY` = ваш реальный refresh_key

   Значения вписываются только в панели Railway — не в код и не в git.
5. Railway сам передаёт приложению переменную `PORT`; сервер уже слушает
   её (`server.js`).
6. После деплоя откройте выданный Railway URL — форма фильтров и поиск
   тендеров должны работать.

## Структура проекта

```
server.js              # Express-сервер, роуты /api/search и /api/dictionaries
lib/tenderguru.js       # Построение запроса к TenderGuru, пагинация, ошибки
lib/normalize.js        # Приведение ответа TenderGuru к единому формату
config/params.js        # Соответствие фильтров и query-параметров TenderGuru
config/regions.js        # Список регионов РФ для мультивыбора
config/sections.js       # Список разделов тендеров
config/etp.js            # Список электронных площадок
public/                  # Статический фронтенд (HTML/CSS/JS)
```

## API

### `GET /api/dictionaries`
Возвращает списки регионов, разделов и ЭТП для построения формы.

### `POST /api/search`
Тело запроса (все поля не обязательны, кроме постраничной навигации):

```json
{
  "kwords": "ремонт кровли",
  "kwordsWhere": "title",
  "okpd": "41.20",
  "laws": ["44fz", "223fz"],
  "customerType": "state",
  "etp": "РТС-тендер",
  "priceFrom": "100000",
  "priceTo": "5000000",
  "dateFrom": "01.01.2026",
  "dateTo": "31.12.2026",
  "regions": ["Московская область", "Москва"],
  "sections": ["Строительство"],
  "page": 1
}
```

Ответ:

```json
{
  "ok": true,
  "items": [
    {
      "title": "...",
      "number": "...",
      "customer": "...",
      "region": "...",
      "price": "...",
      "deadline": "...",
      "law": "...",
      "url": "..."
    }
  ],
  "page": 1,
  "onPage": 50,
  "total": 137,
  "hasMore": true
}
```

При ошибке: `{ "ok": false, "code": "...", "message": "..." }` —
обрабатываются неверный ключ, ошибки/лимиты API и пустая выдача.

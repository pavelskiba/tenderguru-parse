require('dotenv').config();

const path = require('path');
const express = require('express');

const { searchTenders, TenderGuruError } = require('./lib/tenderguru');
const regions = require('./config/regions');
const sections = require('./config/sections');
const etp = require('./config/etp');
const store = require('./lib/store');
const scheduler = require('./lib/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Справочники для фронта (регионы/разделы/ЭТП формируются на сервере,
// чтобы правки в config/* не требовали трогать фронтенд).
app.get('/api/dictionaries', (req, res) => {
  res.json({ regions, sections, etp });
});

app.post('/api/search', async (req, res) => {
  try {
    const filters = req.body || {};
    const result = await searchTenders(filters);
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof TenderGuruError) {
      const status = err.code === 'MISSING_API_KEY' ? 500 : 502;
      return res.status(status).json({ ok: false, code: err.code, message: err.message });
    }
    console.error('Unexpected error in /api/search:', err);
    res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера.' });
  }
});

// Настройки автономного мониторинга: сохранённые фильтры + расписание + каналы доставки.
app.get('/api/settings', (req, res) => {
  res.json({ ok: true, settings: store.getSettings() });
});

app.post('/api/settings', (req, res) => {
  const { filters, schedule, delivery } = req.body || {};

  if (schedule && schedule.enabled && !scheduler.validateCron(schedule.cron)) {
    return res.status(400).json({ ok: false, message: 'Некорректное cron-выражение расписания.' });
  }

  const saved = store.saveSettings({ filters, schedule, delivery });
  scheduler.reschedule();
  res.json({ ok: true, settings: saved });
});

// Журнал запусков планировщика — для отображения на странице настроек.
app.get('/api/scheduler/status', (req, res) => {
  res.json({ ok: true, logs: store.getLogs(20) });
});

// Ручной запуск проверки по сохранённым фильтрам — удобно для проверки
// настроек доставки, не дожидаясь ближайшего срабатывания по расписанию.
app.post('/api/scheduler/run-now', async (req, res) => {
  try {
    const result = await scheduler.runOnce('manual');
    res.json({ ok: true, result });
  } catch (err) {
    console.error('Unexpected error in /api/scheduler/run-now:', err);
    res.status(500).json({ ok: false, message: 'Внутренняя ошибка при ручном запуске проверки.' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`TenderGuru search app listening on port ${PORT}`);
  scheduler.init(PORT);
});

require('dotenv').config();

const path = require('path');
const express = require('express');

const { searchTenders, TenderGuruError } = require('./lib/tenderguru');
const regions = require('./config/regions');
const sections = require('./config/sections');
const etp = require('./config/etp');

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

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`TenderGuru search app listening on port ${PORT}`);
});

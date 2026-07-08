/**
 * Файловое хранилище состояния мониторинга (настройки, отправленные ID,
 * журнал запусков планировщика). Простой JSON вместо БД — достаточно для
 * одного набора фильтров на инстанс.
 *
 * ВАЖНО про Railway: файловая система контейнера эфемерна и сбрасывается
 * при каждом новом деплое. Чтобы настройки и история отправленных ID не
 * терялись, подключите Railway Volume и укажите его точку монтирования
 * через переменную окружения DATA_DIR (см. README).
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SENT_IDS_FILE = path.join(DATA_DIR, 'sent-ids.json');
const LOG_FILE = path.join(DATA_DIR, 'scheduler-log.json');

// Ограничение размера файлов, чтобы они не росли бесконечно на долгоживущем инстансе.
const MAX_SENT_IDS = 5000;
const MAX_LOG_ENTRIES = 200;

const DEFAULT_SETTINGS = {
  filters: null,
  schedule: { cron: '', timezone: process.env.SCHEDULER_TZ || 'Europe/Moscow', enabled: false },
  delivery: { email: false, telegram: false, sheets: false },
  updatedAt: null,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function getSettings() {
  const saved = readJson(SETTINGS_FILE, null);
  if (!saved) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    schedule: { ...DEFAULT_SETTINGS.schedule, ...(saved.schedule || {}) },
    delivery: { ...DEFAULT_SETTINGS.delivery, ...(saved.delivery || {}) },
  };
}

function saveSettings(partial) {
  const current = getSettings();
  const merged = {
    ...current,
    // partial.filters может отсутствовать в запросе — не затираем уже
    // сохранённые фильтры значением undefined в этом случае.
    ...(partial.filters !== undefined ? { filters: partial.filters } : {}),
    schedule: { ...current.schedule, ...(partial.schedule || {}) },
    delivery: { ...current.delivery, ...(partial.delivery || {}) },
    updatedAt: new Date().toISOString(),
  };
  writeJson(SETTINGS_FILE, merged);
  return merged;
}

function getSentIds() {
  return new Set(readJson(SENT_IDS_FILE, []));
}

function addSentIds(ids) {
  if (!ids || !ids.length) return;
  const set = getSentIds();
  ids.forEach((id) => set.add(id));
  let list = Array.from(set);
  if (list.length > MAX_SENT_IDS) {
    list = list.slice(list.length - MAX_SENT_IDS);
  }
  writeJson(SENT_IDS_FILE, list);
}

function appendLog(entry) {
  const list = readJson(LOG_FILE, []);
  list.push(entry);
  const trimmed = list.length > MAX_LOG_ENTRIES ? list.slice(list.length - MAX_LOG_ENTRIES) : list;
  writeJson(LOG_FILE, trimmed);
}

function getLogs(limit) {
  const list = readJson(LOG_FILE, []);
  const ordered = list.slice().reverse(); // новые сверху
  return limit ? ordered.slice(0, limit) : ordered;
}

module.exports = { getSettings, saveSettings, getSentIds, addSentIds, appendLog, getLogs, DATA_DIR };

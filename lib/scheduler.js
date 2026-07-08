const cron = require('node-cron');
const store = require('./store');
const { sendEmail } = require('./delivery/email');
const { sendTelegram } = require('./delivery/telegram');
const { appendToSheet } = require('./delivery/sheets');

let currentTask = null;
let port = null;
let isRunning = false;

// ID — внутренний числовой идентификатор TenderGuru. В отличие от
// TenderNumOuter он не подменяется текстом-заглушкой "Только для подписчиков
// портала: ..." на бесплатных тарифах (см. lib/normalize.js), поэтому именно
// он используется как устойчивый ключ дедупликации между запусками.
function dedupKey(item) {
  if (item.raw && item.raw.ID !== undefined && item.raw.ID !== null && item.raw.ID !== '') {
    return `id:${item.raw.ID}`;
  }
  if (item.number) return `num:${item.number}`;
  if (item.url) return `url:${item.url}`;
  return null;
}

// Планировщик работает в том же Node-процессе, что и Express, поэтому
// использует существующий /api/search по HTTP (127.0.0.1) — логика запроса
// к TenderGuru в lib/tenderguru.js не дублируется и не переписывается.
async function callSearchEndpoint(filters) {
  const res = await fetch(`http://127.0.0.1:${port}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.ok) {
    throw new Error(payload.message || `Ошибка поиска (HTTP ${res.status}).`);
  }
  return payload;
}

async function runOnce(trigger) {
  if (isRunning) {
    console.log('[scheduler] Пропуск запуска — предыдущий ещё выполняется.');
    return { status: 'skipped', message: 'Предыдущий запуск ещё выполняется.' };
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  try {
    const settings = store.getSettings();

    if (!settings.filters) {
      const entry = { time: startedAt, trigger, status: 'skipped', message: 'Настройки фильтров ещё не сохранены.' };
      store.appendLog(entry);
      return entry;
    }

    let payload;
    try {
      payload = await callSearchEndpoint({ ...settings.filters, page: 1 });
    } catch (err) {
      console.error('[scheduler] Ошибка поиска тендеров:', err.message);
      const entry = { time: startedAt, trigger, status: 'error', message: err.message };
      store.appendLog(entry);
      return entry;
    }

    const items = payload.items || [];
    const sentIds = store.getSentIds();
    const newItems = items.filter((item) => {
      const key = dedupKey(item);
      return key && !sentIds.has(key);
    });

    if (!newItems.length) {
      console.log(`[scheduler] Проверка завершена: найдено ${items.length}, новых 0.`);
      const entry = { time: startedAt, trigger, status: 'ok', found: items.length, newCount: 0, sentTo: [] };
      store.appendLog(entry);
      return entry;
    }

    const sentTo = [];
    const errors = [];

    if (settings.delivery.email) {
      try {
        await sendEmail(newItems);
        sentTo.push('email');
      } catch (err) {
        console.error('[scheduler] Ошибка отправки email:', err.message);
        errors.push(`email: ${err.message}`);
      }
    }

    if (settings.delivery.telegram) {
      try {
        await sendTelegram(newItems);
        sentTo.push('telegram');
      } catch (err) {
        console.error('[scheduler] Ошибка отправки в Telegram:', err.message);
        errors.push(`telegram: ${err.message}`);
      }
    }

    if (settings.delivery.sheets) {
      try {
        await appendToSheet(newItems);
        sentTo.push('sheets');
      } catch (err) {
        console.error('[scheduler] Ошибка записи в Google Sheets:', err.message);
        errors.push(`sheets: ${err.message}`);
      }
    }

    store.addSentIds(newItems.map(dedupKey).filter(Boolean));
    console.log(
      `[scheduler] Проверка завершена: найдено ${items.length}, новых ${newItems.length}, отправлено: ${sentTo.join(', ') || '—'}.`
    );
    const entry = {
      time: startedAt,
      trigger,
      status: errors.length ? 'partial' : 'ok',
      found: items.length,
      newCount: newItems.length,
      sentTo,
      errors,
    };
    store.appendLog(entry);
    return entry;
  } finally {
    isRunning = false;
  }
}

function stop() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }
}

function validateCron(expr) {
  return typeof expr === 'string' && expr.trim() !== '' && cron.validate(expr.trim());
}

function reschedule() {
  stop();
  const settings = store.getSettings();
  const { cron: expr, enabled, timezone } = settings.schedule || {};

  if (!enabled || !expr) {
    console.log('[scheduler] Автоматический запуск выключен или расписание не задано.');
    return;
  }
  if (!validateCron(expr)) {
    console.error(`[scheduler] Некорректное cron-выражение "${expr}" — расписание не запущено.`);
    return;
  }

  currentTask = cron.schedule(expr, () => runOnce('cron'), {
    timezone: timezone || 'Europe/Moscow',
  });
  console.log(`[scheduler] Запланировано: "${expr}" (${timezone || 'Europe/Moscow'}).`);
}

function init(appPort) {
  port = appPort;
  reschedule();
}

module.exports = { init, reschedule, runOnce, stop, validateCron };

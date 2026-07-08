// Без сторонних SDK — Telegram Bot API дергается напрямую через fetch (Node 18+).

const TELEGRAM_MAX_LEN = 4096;

function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return '—';
  const num = Number(price);
  return Number.isNaN(num) ? escapeHtml(price) : `${num.toLocaleString('ru-RU')} ₽`;
}

function formatItem(item) {
  const lines = [
    `<b>${escapeHtml(item.title || 'Без названия')}</b>`,
    `Заказчик: ${escapeHtml(item.customer || '—')}`,
    `Регион: ${escapeHtml(item.region || '—')}`,
    `Цена: ${formatPrice(item.price)}`,
    `Срок подачи: ${escapeHtml(item.deadline || '—')}`,
  ];
  if (item.url) lines.push(`<a href="${escapeHtml(item.url)}">Открыть тендер</a>`);
  return lines.join('\n');
}

// Telegram ограничивает сообщение 4096 символами — при большом числе новых
// тендеров разбиваем на несколько сообщений, не разрывая карточку тендера.
function chunkMessages(items, header) {
  const chunks = [];
  let current = header;
  for (const item of items) {
    const block = `${formatItem(item)}\n\n`;
    if ((current + block).length > TELEGRAM_MAX_LEN && current !== header) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendTelegram(items) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Не заданы переменные окружения TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID.');
  }

  const chunks = chunkMessages(items, `Новые тендеры: ${items.length}\n\n`);

  for (const text of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.ok) {
      throw new Error(payload.description || `Telegram API вернул ошибку HTTP ${res.status}.`);
    }
  }
}

module.exports = { sendTelegram };

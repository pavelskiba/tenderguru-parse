function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return '—';
  const num = Number(price);
  return Number.isNaN(num) ? escapeHtml(price) : `${num.toLocaleString('ru-RU')} ₽`;
}

function formatRow(item) {
  const titleCell = item.url
    ? `<a href="${escapeHtml(item.url)}">${escapeHtml(item.title || 'Без названия')}</a>`
    : escapeHtml(item.title || 'Без названия');
  return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${titleCell}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(item.customer || '—')}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(item.region || '—')}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${formatPrice(item.price)}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(item.deadline || '—')}</td>
    </tr>`;
}

// Отправка через HTTPS API Resend вместо SMTP — Railway блокирует исходящий
// SMTP на тарифах ниже Pro (https://docs.railway.com/reference/outbound-networking),
// а обычный HTTPS-запрос эту блокировку не задевает.
async function sendEmail(items) {
  const { EMAIL_TO, RESEND_API_KEY, RESEND_FROM } = process.env;
  if (!EMAIL_TO) throw new Error('Не задана переменная окружения EMAIL_TO.');
  if (!RESEND_API_KEY) throw new Error('Не задана переменная окружения RESEND_API_KEY.');

  const rows = items.map(formatRow).join('');
  const html = `
    <h2>Новые тендеры: ${items.length}</h2>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Название</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Заказчик</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Регион</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Цена</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Срок подачи</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM || 'onboarding@resend.dev',
      to: EMAIL_TO,
      subject: `Новые тендеры (${items.length}) — ${new Date().toLocaleDateString('ru-RU')}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API вернул ошибку (HTTP ${res.status}): ${body}`);
  }
}

module.exports = { sendEmail };

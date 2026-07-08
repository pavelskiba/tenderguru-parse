const nodemailer = require('nodemailer');

function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Не заданы переменные окружения SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

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

async function sendEmail(items) {
  const { EMAIL_TO, SMTP_USER } = process.env;
  if (!EMAIL_TO) throw new Error('Не задана переменная окружения EMAIL_TO.');

  const transport = buildTransport();
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

  await transport.sendMail({
    from: SMTP_USER,
    to: EMAIL_TO,
    subject: `Новые тендеры (${items.length}) — ${new Date().toLocaleDateString('ru-RU')}`,
    html,
  });
}

module.exports = { sendEmail };

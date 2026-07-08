// google-auth-library вместо полного пакета googleapis — нужна только
// JWT-аутентификация сервисного аккаунта и один REST-вызов Sheets API
// (values.append), поэтому тяжёлая обёртка googleapis не нужна.
const { JWT } = require('google-auth-library');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Не задана переменная окружения GOOGLE_SERVICE_ACCOUNT_JSON.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON содержит невалидный JSON.');
  }
}

async function appendToSheet(items) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('Не задана переменная окружения SPREADSHEET_ID.');

  const credentials = loadCredentials();
  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
  });

  const values = items.map((item) => [
    new Date().toLocaleString('ru-RU'),
    item.title || '',
    item.customer || '',
    item.region || '',
    item.price || '',
    item.deadline || '',
    item.law || '',
    item.url || '',
  ]);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/A1:append?valueInputOption=USER_ENTERED`;
  await client.request({ url, method: 'POST', data: { values } });
}

module.exports = { appendToSheet };

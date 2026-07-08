(function () {
  const form = document.getElementById('filters-form');
  const submitBtn = document.getElementById('submit-btn');
  const previewBtn = document.getElementById('preview-btn');
  const runNowBtn = document.getElementById('run-now-btn');
  const statusBar = document.getElementById('status-bar');
  const tableWrap = document.getElementById('results-table-wrap');
  const pagination = document.getElementById('pagination');
  const regionList = document.getElementById('region-list');
  const sectionList = document.getElementById('section-list');
  const regionFilterInput = document.getElementById('region-filter');
  const etpSelect = document.getElementById('etp');
  const etpFilterInput = document.getElementById('etp-filter');
  const cronPreset = document.getElementById('cron-preset');
  const cronExpr = document.getElementById('cron-expr');
  const scheduleEnabled = document.getElementById('schedule-enabled');
  const schedulerLog = document.getElementById('scheduler-log');

  // items: массив {id, name}
  function renderCheckboxGroup(container, items, name) {
    container.innerHTML = items
      .map(
        (item, i) => `
        <label data-search="${escapeAttr(item.name.toLowerCase())}">
          <input type="checkbox" name="${name}" value="${item.id}" id="${name}-${i}" />
          ${escapeHtml(item.name)}
        </label>`
      )
      .join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  async function loadDictionaries() {
    try {
      const res = await fetch('/api/dictionaries');
      const data = await res.json();
      renderCheckboxGroup(regionList, data.regions || [], 'regions');
      renderCheckboxGroup(sectionList, data.sections || [], 'sections');
      (data.etp || []).forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name;
        opt.dataset.search = item.name.toLowerCase();
        etpSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Не удалось загрузить справочники', err);
    }
  }

  etpFilterInput.addEventListener('input', () => {
    const q = etpFilterInput.value.trim().toLowerCase();
    Array.from(etpSelect.options).forEach((opt) => {
      if (!opt.value) return; // "Любая"
      opt.hidden = !opt.dataset.search.includes(q);
    });
  });

  regionFilterInput.addEventListener('input', () => {
    const q = regionFilterInput.value.trim().toLowerCase();
    regionList.querySelectorAll('label').forEach((label) => {
      label.style.display = label.dataset.search.includes(q) ? '' : 'none';
    });
  });

  cronPreset.addEventListener('change', () => {
    if (cronPreset.value) cronExpr.value = cronPreset.value;
  });

  function getCheckedValues(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
  }

  function setCheckedValues(name, values) {
    const set = new Set((values || []).map(String));
    form.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
      el.checked = set.has(el.value);
    });
  }

  function buildFilters(page) {
    const data = new FormData(form);
    return {
      kwords: data.get('kwords')?.trim() || '',
      kwordsWhere: data.get('kwordsWhere') || '',
      okpd: data.get('okpd')?.trim() || '',
      laws: getCheckedValues('laws'),
      customerType: data.get('customerType') || '',
      etp: data.get('etp')?.trim() || '',
      priceFrom: data.get('priceFrom') || '',
      priceTo: data.get('priceTo') || '',
      dateFrom: formatDate(data.get('dateFrom')),
      dateTo: formatDate(data.get('dateTo')),
      regions: getCheckedValues('regions'),
      sections: getCheckedValues('sections'),
      page,
    };
  }

  function formatDate(value) {
    if (!value) return '';
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }

  // Обратное преобразование дд.мм.гггг -> гггг-мм-дд для <input type="date">.
  function parseDateForInput(value) {
    if (!value) return '';
    const [d, m, y] = value.split('.');
    if (!d || !m || !y) return '';
    return `${y}-${m}-${d}`;
  }

  function setStatus(message, type) {
    statusBar.textContent = message;
    statusBar.className = 'status-bar' + (type ? ' ' + type : '');
  }

  function renderResults(payload) {
    const items = payload.items || [];
    if (!items.length) {
      tableWrap.innerHTML = '<div class="empty-state">Ничего не найдено. Попробуйте изменить фильтры.</div>';
      pagination.innerHTML = '';
      return;
    }

    const rows = items
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.title || '—')}</td>
          <td>${escapeHtml(item.number || '—')}</td>
          <td>${escapeHtml(item.customer || '—')}</td>
          <td>${escapeHtml(item.region || '—')}</td>
          <td>${formatPrice(item.price)}</td>
          <td>${escapeHtml(item.deadline || '—')}</td>
          <td>${escapeHtml(item.law || '—')}</td>
          <td>${item.url ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener">Открыть</a>` : '—'}</td>
        </tr>`)
      .join('');

    tableWrap.innerHTML = `
      <table class="results-table">
        <thead>
          <tr>
            <th>Название</th><th>Номер</th><th>Заказчик</th><th>Регион</th>
            <th>Цена</th><th>Окончание подачи</th><th>Закон</th><th>Источник</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    renderPagination(payload);
  }

  function formatPrice(price) {
    if (price === null || price === undefined || price === '') return '—';
    const num = Number(price);
    if (Number.isNaN(num)) return escapeHtml(price);
    return num.toLocaleString('ru-RU') + ' ₽';
  }

  function renderPagination(payload) {
    const { page, hasMore } = payload;
    pagination.innerHTML = '';
    if (page <= 1 && !hasMore) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Назад';
    prevBtn.disabled = page <= 1;
    prevBtn.onclick = () => runSearch(page - 1);

    const info = document.createElement('span');
    info.textContent = `Страница ${page}`;
    info.style.alignSelf = 'center';

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Вперёд →';
    nextBtn.disabled = !hasMore;
    nextBtn.onclick = () => runSearch(page + 1);

    pagination.append(prevBtn, info, nextBtn);
  }

  // Предпросмотр — обычный ручной поиск по текущим значениям формы,
  // без сохранения и без влияния на планировщик.
  async function runSearch(page) {
    previewBtn.disabled = true;
    setStatus('Загрузка…');
    tableWrap.innerHTML = '';
    pagination.innerHTML = '';

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFilters(page)),
      });
      const payload = await res.json();

      if (!res.ok || !payload.ok) {
        setStatus(payload.message || 'Не удалось получить тендеры.', 'error');
        tableWrap.innerHTML = '';
        pagination.innerHTML = '';
        return;
      }

      const total = payload.total ? `, всего найдено: ${payload.total}` : '';
      setStatus(`Найдено на странице: ${payload.items.length}${total}`, 'ok');
      renderResults(payload);
    } catch (err) {
      setStatus('Ошибка сети при обращении к серверу.', 'error');
    } finally {
      previewBtn.disabled = false;
    }
  }

  function buildSettingsPayload() {
    const filters = buildFilters(1);
    delete filters.page;
    return {
      filters,
      schedule: {
        cron: cronExpr.value.trim(),
        enabled: scheduleEnabled.checked,
        timezone: 'Europe/Moscow',
      },
      delivery: {
        email: document.getElementById('delivery-email').checked,
        telegram: document.getElementById('delivery-telegram').checked,
        sheets: document.getElementById('delivery-sheets').checked,
      },
    };
  }

  async function saveSettings() {
    submitBtn.disabled = true;
    setStatus('Сохранение настроек…');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSettingsPayload()),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setStatus(payload.message || 'Не удалось сохранить настройки.', 'error');
        return;
      }
      setStatus('Настройки сохранены. Автоматическая проверка будет выполняться по расписанию.', 'ok');
    } catch (err) {
      setStatus('Ошибка сети при сохранении настроек.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function runNow() {
    runNowBtn.disabled = true;
    setStatus('Выполняется проверка…');
    try {
      const res = await fetch('/api/scheduler/run-now', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setStatus(payload.message || 'Не удалось выполнить проверку.', 'error');
        return;
      }
      const r = payload.result || {};
      if (r.status === 'skipped') {
        setStatus(r.message || 'Проверка пропущена.', null);
      } else if (r.status === 'error') {
        setStatus(r.message || 'Ошибка при проверке.', 'error');
      } else {
        setStatus(`Проверка завершена: найдено ${r.found ?? '—'}, новых ${r.newCount ?? 0}.`, 'ok');
      }
      loadSchedulerLog();
    } catch (err) {
      setStatus('Ошибка сети при запуске проверки.', 'error');
    } finally {
      runNowBtn.disabled = false;
    }
  }

  const STATUS_LABELS = {
    ok: 'Успешно',
    error: 'Ошибка',
    partial: 'Частично',
    skipped: 'Пропущено',
  };
  const TRIGGER_LABELS = { cron: 'по расписанию', manual: 'вручную' };
  const CHANNEL_LABELS = { email: 'Email', telegram: 'Telegram', sheets: 'Google Sheets' };

  async function loadSchedulerLog() {
    try {
      const res = await fetch('/api/scheduler/status');
      const payload = await res.json();
      const logs = (payload && payload.logs) || [];

      if (!logs.length) {
        schedulerLog.innerHTML = '<div class="empty-state">Запусков ещё не было.</div>';
        return;
      }

      const rows = logs
        .map((entry) => {
          const time = entry.time ? new Date(entry.time).toLocaleString('ru-RU') : '—';
          const trigger = TRIGGER_LABELS[entry.trigger] || entry.trigger || '—';
          const status = STATUS_LABELS[entry.status] || entry.status || '—';
          const found = entry.found ?? '—';
          const newCount = entry.newCount ?? '—';
          const sentTo = (entry.sentTo || []).map((c) => CHANNEL_LABELS[c] || c).join(', ') || '—';
          const message = entry.message || (entry.errors && entry.errors.join('; ')) || '';
          return `
            <tr>
              <td>${escapeHtml(time)}</td>
              <td>${escapeHtml(trigger)}</td>
              <td><span class="log-status ${escapeAttr(entry.status || '')}">${escapeHtml(status)}</span></td>
              <td>${escapeHtml(String(found))}</td>
              <td>${escapeHtml(String(newCount))}</td>
              <td>${escapeHtml(sentTo)}</td>
              <td>${escapeHtml(message)}</td>
            </tr>`;
        })
        .join('');

      schedulerLog.innerHTML = `
        <table class="log-table">
          <thead>
            <tr>
              <th>Время</th><th>Запуск</th><th>Статус</th><th>Найдено</th>
              <th>Новых</th><th>Отправлено</th><th>Комментарий</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } catch (err) {
      console.error('Не удалось загрузить журнал планировщика', err);
    }
  }

  function applySettings(settings) {
    if (!settings) return;

    const f = settings.filters;
    if (f) {
      form.elements.kwords.value = f.kwords || '';
      form.elements.kwordsWhere.value = f.kwordsWhere || '';
      form.elements.okpd.value = f.okpd || '';
      setCheckedValues('laws', f.laws);
      form.querySelectorAll('input[name="customerType"]').forEach((el) => {
        el.checked = el.value === (f.customerType || '');
      });
      etpSelect.value = f.etp || '';
      form.elements.priceFrom.value = f.priceFrom || '';
      form.elements.priceTo.value = f.priceTo || '';
      form.elements.dateFrom.value = parseDateForInput(f.dateFrom);
      form.elements.dateTo.value = parseDateForInput(f.dateTo);
      setCheckedValues('regions', f.regions);
      setCheckedValues('sections', f.sections);
    }

    const s = settings.schedule;
    if (s) {
      cronExpr.value = s.cron || '';
      scheduleEnabled.checked = !!s.enabled;
    }

    const d = settings.delivery;
    if (d) {
      document.getElementById('delivery-email').checked = !!d.email;
      document.getElementById('delivery-telegram').checked = !!d.telegram;
      document.getElementById('delivery-sheets').checked = !!d.sheets;
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const payload = await res.json();
      if (payload && payload.ok) applySettings(payload.settings);
    } catch (err) {
      console.error('Не удалось загрузить сохранённые настройки', err);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  previewBtn.addEventListener('click', () => runSearch(1));
  runNowBtn.addEventListener('click', () => runNow());

  (async function init() {
    await loadDictionaries();
    await loadSettings();
    loadSchedulerLog();
  })();
})();

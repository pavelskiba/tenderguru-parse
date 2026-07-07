(function () {
  const form = document.getElementById('filters-form');
  const submitBtn = document.getElementById('submit-btn');
  const statusBar = document.getElementById('status-bar');
  const tableWrap = document.getElementById('results-table-wrap');
  const pagination = document.getElementById('pagination');
  const regionList = document.getElementById('region-list');
  const sectionList = document.getElementById('section-list');
  const regionFilterInput = document.getElementById('region-filter');
  const etpOptions = document.getElementById('etp-options');

  let currentPage = 1;

  function renderCheckboxGroup(container, values, name) {
    container.innerHTML = values
      .map(
        (value, i) => `
        <label data-search="${value.toLowerCase()}">
          <input type="checkbox" name="${name}" value="${escapeAttr(value)}" id="${name}-${i}" />
          ${escapeHtml(value)}
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
      etpOptions.innerHTML = (data.etp || [])
        .map((name) => `<option value="${escapeAttr(name)}"></option>`)
        .join('');
    } catch (err) {
      console.error('Не удалось загрузить справочники', err);
    }
  }

  regionFilterInput.addEventListener('input', () => {
    const q = regionFilterInput.value.trim().toLowerCase();
    regionList.querySelectorAll('label').forEach((label) => {
      label.style.display = label.dataset.search.includes(q) ? '' : 'none';
    });
  });

  function getCheckedValues(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
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

  async function runSearch(page) {
    currentPage = page;
    submitBtn.disabled = true;
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
      submitBtn.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch(1);
  });

  loadDictionaries();
})();

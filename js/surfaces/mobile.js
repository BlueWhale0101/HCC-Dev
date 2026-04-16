const MOBILE_TABS = {
  status: { label: 'Status', subtitle: (context) => 'Whole-house summary', render: (context) => renderMobileStatus(context) },
  logs: { label: 'Logs', subtitle: () => 'Recent actions and links', render: () => renderMobileLogs() },
  calendar: { label: 'Calendar', subtitle: () => `${appState.calendarAccounts.length} connected account${appState.calendarAccounts.length === 1 ? '' : 's'}`, render: () => renderMobileCalendar() },
  weather: { label: 'Weather', subtitle: () => appState.config.weatherLocationName || appState.config.weatherLocationQuery || 'Weather configuration', render: () => renderMobileWeather() },
  signals: { label: 'Signals', subtitle: () => 'Household reminder rules and previews', render: () => renderMobileSignals() },
  debug: { subtitle: () => appState.testTimeOverride ? `Test time active · ${new Date(appState.testTimeOverride).toLocaleString()}` : 'Diagnostics and test controls', label: 'Debug', render: () => renderMobileDebug() },
};

function getMobileTabDefinition(tabKey) {
  return MOBILE_TABS[tabKey] || MOBILE_TABS.status;
}

function getMobileTabs() {
  return Object.entries(MOBILE_TABS);
}

function buildMobileStack() {
  const wrap = document.createElement('div');
  wrap.className = 'mobile-stack';
  return wrap;
}

function buildEmptyState(message, extraClass = '') {
  const empty = document.createElement('div');
  empty.className = `empty-state ${extraClass}`.trim();
  empty.textContent = message;
  return empty;
}

function buildPill(text, extraClass = '') {
  const pill = document.createElement('span');
  pill.className = `pill ${extraClass}`.trim();
  pill.textContent = text;
  return pill;
}

function buildListItem(item, options = {}) {
  const rowTag = options.tagName || 'div';
  const row = document.createElement(rowTag);
  row.className = options.rowClassName || 'list-item';
  if (item?.rowClass) row.classList.add(...String(item.rowClass).split(/\s+/).filter(Boolean));
  if (item?.ownerKey) {
    row.dataset.owner = item.ownerKey;
    row.classList.add(`owner-${item.ownerKey}`);
  }
  if (item?.emphasis) row.dataset.emphasis = item.emphasis;

  const left = document.createElement('div');
  left.className = options.leftClassName || 'list-item-left';
  const title = document.createElement('div');
  title.className = options.titleClassName || 'list-item-title';
  title.textContent = item.title || '';
  left.append(title);

  const metaText = item.meta || '';
  if (metaText || options.showMeta !== false) {
    const meta = document.createElement('div');
    meta.className = options.metaClassName || 'list-item-meta';
    meta.textContent = metaText;
    left.append(meta);
  }

  row.append(left);
  if (options.showPills && item.pill) {
    row.append(buildPill(item.pill, item.pillClass || ''));
  }

  if (typeof options.onActivate === 'function') {
    row.classList.add('list-item-interactive');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.style.cursor = 'pointer';
    if (item.actionHint) row.title = item.actionHint;
    row.addEventListener('click', (event) => {
      event.preventDefault();
      options.onActivate(event);
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        options.onActivate(event);
      }
    });
  }

  return row;
}

function buildCardSectionHeader(titleText, subtitleText = '') {
  const wrap = document.createElement('div');
  wrap.className = 'card-header';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'card-title-wrap';
  const title = document.createElement('h2');
  title.textContent = titleText;
  const subtitle = document.createElement('span');
  subtitle.className = 'card-subtitle';
  subtitle.textContent = subtitleText || '';
  titleWrap.append(title, subtitle);
  wrap.append(titleWrap);
  return wrap;
}

function appendCards(container, cards) {
  for (const card of cards) {
    if (card) container.append(card);
  }
  return container;
}

function renderMobileControlPanel(context) {
  screenEl.className = 'screen single-column mobile-control-screen';
  screenEl.replaceChildren();

  const tabs = getMobileTabs();
  const activeTab = getMobileTabDefinition(appState.mobileTab);

  const nav = document.createElement('div');
  nav.className = 'mobile-tabs';
  for (const [key, def] of tabs) {
    const label = def.label;
    const btn = document.createElement('button');
    btn.className = `mobile-tab-button ${appState.mobileTab === key ? 'active' : ''}`.trim();
    btn.textContent = label;
    btn.addEventListener('click', () => {
      appState.mobileTab = key;
      renderMode();
    });
    nav.append(btn);
  }
  screenEl.append(nav);

  const panel = document.createElement('section');
  panel.className = 'card mobile-panel';
  const body = document.createElement('div');
  body.className = 'card-body';

  panel.append(buildCardSectionHeader(activeTab.label, activeTab.subtitle(context)));

  let content;
  try {
    content = activeTab.render(context);
  } catch (error) {
    handleRuntimeActionError(`Could not render ${appState.mobileTab} tab`, error);
    content = renderInlineErrorCard(`The ${appState.mobileTab} tab hit an error.`, error);
  }
  body.append(content);
  panel.append(body);
  screenEl.append(panel);
}

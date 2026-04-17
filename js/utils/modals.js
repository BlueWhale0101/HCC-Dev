
window.HCC = window.HCC || {};
window.HCC.ui = window.HCC.ui || {};

HCC.ui.ensureDialog = function ensureDialog(id, className, markup) {
  let dialog = document.getElementById(id);
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = id;
    dialog.className = className;
    dialog.innerHTML = markup;
    document.body.append(dialog);
  }
  return dialog;
};

HCC.ui.showDialog = function showDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', 'open');
};

HCC.ui.openTaskCategoryOverrideModal = function openTaskCategoryOverrideModal(task, options = {}) {
  if (!task?.id) return;
  const defs = Array.isArray(HCC?.tasks?.CATEGORY_DEFINITIONS) ? HCC.tasks.CATEGORY_DEFINITIONS : [];
  const currentOverride = getTaskCategoryOverride(task.id);
  const inferred = HCC?.tasks?.inferCategory ? HCC.tasks.inferCategory({ ...task, manualCategory: '' }) : (task.category || 'general');
  const draft = { value: currentOverride || 'auto' };
  const mountInto = options?.mountInto || null;
  const onDone = typeof options?.onDone === 'function' ? options.onDone : null;
  const onCancel = typeof options?.onCancel === 'function' ? options.onCancel : null;

  const closeInline = () => {
    if (mountInto) {
      mountInto.innerHTML = '';
      mountInto.classList.add('hidden');
    }
    if (onCancel) onCancel();
  };

  const saveOverride = () => {
    setTaskCategoryOverride(task.id, draft.value);
    if (mountInto) {
      mountInto.innerHTML = '';
      mountInto.classList.add('hidden');
    }
    showToast(draft.value === 'auto' ? 'Category override cleared' : `Category set to ${HCC?.tasks?.getCategoryLabel ? HCC.tasks.getCategoryLabel(draft.value) : draft.value}`);
    renderMode();
    if (onDone) onDone(draft.value);
  };

  if (mountInto) {
    mountInto.innerHTML = '';
    mountInto.classList.remove('hidden');
    mountInto.classList.add('bedroom-inline-category-editor');

    const title = document.createElement('div');
    title.className = 'bedroom-inline-category-title';
    title.textContent = 'Task category';

    const body = document.createElement('div');
    body.className = 'mobile-stack signal-modal-form';
    body.append(makeSelectField('Category override', [['auto', `Auto (inferred: ${HCC?.tasks?.getCategoryLabel ? HCC.tasks.getCategoryLabel(inferred) : inferred})`], ...defs.map((def) => [def.key, def.label])], draft.value, (value) => {
      draft.value = value;
    }));

    const hint = document.createElement('div');
    hint.className = 'muted';
    hint.textContent = currentOverride
      ? `Current override: ${HCC?.tasks?.getCategoryLabel ? HCC.tasks.getCategoryLabel(currentOverride) : currentOverride}. Switch back to Auto to clear it.`
      : 'Overrides are local to this device for now. Auto uses the inferred category.';
    body.append(hint);

    const footer = document.createElement('div');
    footer.className = 'signal-modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'secondary-button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', closeInline);
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'primary-button';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', saveOverride);
    footer.append(cancelBtn, saveBtn);

    mountInto.append(title, body, footer);
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay signal-modal-overlay';
  const panel = document.createElement('section');
  panel.className = 'modal-panel signal-modal-panel';
  const body = document.createElement('div');
  body.className = 'mobile-stack signal-modal-form';

  const close = () => overlay.remove();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const header = document.createElement('div');
  header.className = 'signal-modal-header';
  const title = document.createElement('div');
  title.className = 'signal-modal-title';
  title.textContent = 'Task category';
  const subtitle = document.createElement('div');
  subtitle.className = 'signal-modal-subtitle';
  subtitle.textContent = task.title || 'Untitled task';
  header.append(title, subtitle);

  body.append(makeSelectField('Category override', [['auto', `Auto (inferred: ${HCC?.tasks?.getCategoryLabel ? HCC.tasks.getCategoryLabel(inferred) : inferred})`], ...defs.map((def) => [def.key, def.label])], draft.value, (value) => {
    draft.value = value;
  }));

  const hint = document.createElement('div');
  hint.className = 'muted';
  hint.textContent = currentOverride
    ? `Current override: ${HCC?.tasks?.getCategoryLabel ? HCC.tasks.getCategoryLabel(currentOverride) : currentOverride}. Switch back to Auto to clear it.`
    : 'Overrides are local to this device for now. Auto uses the inferred category.';
  body.append(hint);

  const footer = document.createElement('div');
  footer.className = 'signal-modal-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'secondary-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', close);
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'primary-button';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    saveOverride();
    close();
  });
  footer.append(cancelBtn, saveBtn);

  panel.append(header, body, footer);
  overlay.append(panel);
  document.body.append(overlay);
};

HCC.ui.openBedroomItemModal = function openBedroomItemModal(item, options = {}) {
  if (!item) return;
  const dialog = HCC.ui.ensureDialog('bedroom-detail-dialog', 'quick-view-dialog bedroom-detail-dialog', `
    <form method="dialog" class="quick-view-form settings-form bedroom-detail-form">
      <div class="dialog-header">
        <h2 id="bedroom-detail-title">Details</h2>
        <button value="cancel" class="secondary-button" type="button" data-close-dialog="true">Close</button>
      </div>
      <div id="bedroom-detail-body" class="bedroom-detail-body"></div>
    </form>
  `);

  const kind = options.kind || item.kind || 'item';
  dialog.querySelector('#bedroom-detail-title').textContent = kind === 'event'
    ? 'Next Event'
    : kind === 'signal'
      ? 'Signal'
      : 'Best Next';

  const closeBtn = dialog.querySelector('[data-close-dialog="true"]');
  if (closeBtn) closeBtn.onclick = () => dialog.close();

  const body = dialog.querySelector('#bedroom-detail-body');
  body.replaceChildren();

  const inlineCategoryHost = document.createElement('section');
  inlineCategoryHost.className = 'hidden';
  inlineCategoryHost.id = 'bedroom-inline-category-host';

  const hero = document.createElement('section');
  hero.className = `bedroom-detail-hero ${item.categoryKey ? `spotlight-category-${item.categoryKey}` : ''}`.trim();

  const top = document.createElement('div');
  top.className = 'bedroom-detail-top';
  if (item.pill) top.append(buildPill(item.pill, item.pillClass || ''));
  if (item?.categoryDebug?.manualOverride) top.append(buildPill('Manual', 'notice'));
  if (kind === 'task') {
    const editButton = buildSecondaryButton('Change category', () => {
      const task = normalizeTaskRows().find((candidate) => candidate.id === item.id) || appState.tasks.find((candidate) => candidate.id === item.id);
      if (task) HCC.ui.openTaskCategoryOverrideModal(task, { mountInto: inlineCategoryHost });
    }, 'mini-button');
    top.append(editButton);
  }
  hero.append(top);

  const title = document.createElement('div');
  title.className = 'bedroom-detail-title';
  title.textContent = item.title || 'Untitled';
  hero.append(title);

  if (item.meta) {
    const meta = document.createElement('div');
    meta.className = 'bedroom-detail-meta';
    meta.textContent = item.meta;
    hero.append(meta);
  }

  if (item.actionHint) {
    const hint = document.createElement('div');
    hint.className = 'bedroom-detail-hint';
    hint.textContent = item.actionHint;
    hero.append(hint);
  }

  body.append(hero, inlineCategoryHost);
  HCC.ui.showDialog(dialog);
};

HCC.ui.openBedroomStatusModal = function openBedroomStatusModal() {
  const dialog = HCC.ui.ensureDialog('bedroom-status-dialog', 'quick-view-dialog bedroom-status-dialog', `
    <form method="dialog" class="quick-view-form settings-form bedroom-detail-form">
      <div class="dialog-header">
        <h2>System status</h2>
        <button value="cancel" class="secondary-button" type="button" data-close-dialog="true">Close</button>
      </div>
      <div id="bedroom-status-body" class="bedroom-detail-body"></div>
    </form>
  `);

  const closeBtn = dialog.querySelector('[data-close-dialog="true"]');
  if (closeBtn) closeBtn.onclick = () => dialog.close();

  const body = dialog.querySelector('#bedroom-status-body');
  body.replaceChildren();

  const health = getAmbientHealthState();
  const summary = document.createElement('section');
  summary.className = `bedroom-status-summary bedroom-status-summary-${health.level}`;

  const summaryTop = document.createElement('div');
  summaryTop.className = 'bedroom-detail-top';
  summaryTop.append(
    buildPill(health.level === 'degraded' ? 'Degraded' : health.level === 'aging' ? 'Aging' : 'Healthy', health.level === 'degraded' ? 'warning' : health.level === 'aging' ? 'notice' : ''),
    buildPill(`v${APP_VERSION || 'unknown'}`)
  );
  summary.append(summaryTop);

  const summaryTitle = document.createElement('div');
  summaryTitle.className = 'bedroom-detail-title';
  summaryTitle.textContent = health.title || 'System status';
  summary.append(summaryTitle);

  const summaryMeta = document.createElement('div');
  summaryMeta.className = 'bedroom-detail-meta';
  summaryMeta.textContent = health.message || 'Live view is healthy.';
  summary.append(summaryMeta);
  body.append(summary);

  const calendarState = getCalendarServiceState();
  const weatherState = getWeatherServiceState();
  const sections = [
    { title: 'Freshness', items: getDataFreshnessItems(), empty: 'No freshness data available yet.' },
    { title: 'Calendar', items: calendarState.items, empty: 'No calendar accounts are connected yet.' },
    {
      title: 'Weather',
      items: weatherState.items.length ? weatherState.items : [{ title: weatherState.locationLabel, meta: 'Weather is not configured yet.', pill: 'Setup', pillClass: 'warning' }],
      empty: 'No weather status available yet.',
    },
  ];

  sections.forEach((sectionDef) => {
    const card = document.createElement('section');
    card.className = 'bedroom-status-section';
    const titleEl = document.createElement('h3');
    titleEl.className = 'bedroom-status-section-title';
    titleEl.textContent = sectionDef.title;
    card.append(titleEl, renderTaskList(sectionDef.items || [], sectionDef.empty, { showPills: true }));
    body.append(card);
  });

  const footerActions = document.createElement('div');
footerActions.className = 'bedroom-status-actions';

footerActions.append(
  buildSecondaryButton('Open settings', () => {
    try { dialog.close(); } catch {}
    if (typeof openSettingsDialog === 'function') {
      openSettingsDialog();
    } else {
      showToast?.('Settings dialog function not found');
    }
  })
);

footerActions.append(
  buildSecondaryButton('Open dev console', () => {
    try { dialog.close(); } catch {}
    if (typeof devConsoleEl !== 'undefined' && devConsoleEl) devConsoleEl.classList.remove('hidden');
    if (typeof renderDevConsole === 'function') renderDevConsole();
  })
);

body.append(footerActions);

HCC.ui.showDialog(dialog);
};

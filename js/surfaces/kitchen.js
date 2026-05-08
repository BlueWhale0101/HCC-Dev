
window.HCC = window.HCC || {};
window.HCC.surfaces = window.HCC.surfaces || {};
window.HCC.surfaces.kitchen = window.HCC.surfaces.kitchen || {};

(function () {
  let kitchenViewMode = 'surface';
  const kitchenOpsFilters = { owner:'all', panel:'all', category:'all', tag:'all', search:'' };
  const kitchenOpsSelectedTaskIds = new Set();
  let kitchenOpsSelectMode = false;

  const KITCHEN_PANEL_OPTIONS = [
    { value: 'backlog', label: 'Backlog' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'inMotion', label: 'In Motion' },
    { value: 'done', label: 'Done' },
    { value: 'archived', label: 'Archive' },
  ];

  function getTaskTitle(task) {
    return task?.title || task?.task || task?.raw?.title || task?.raw?.task || 'Untitled task';
  }

  function getTaskRaw(task) {
    return task?.raw || task || {};
  }

  function getEffectiveCategory(task) {
    return task?.effectiveCategory || task?.category || task?.categoryKey || 'general';
  }

  function buildPanelPayload(task, nextPanel) {
    const raw = getTaskRaw(task);
    const payload = { panel: nextPanel, updated_at: new Date().toISOString() };
    const completedField = String(appState?.config?.taskCompletedField || '').trim();

    if (nextPanel === 'done') {
      payload.completed_at = new Date().toISOString();
      if (completedField && completedField !== 'completed' && Object.prototype.hasOwnProperty.call(raw, completedField)) {
        payload[completedField] = appState.config.useStringCompleted ? appState.config.taskCompletedValue : true;
      }
    } else {
      if (Object.prototype.hasOwnProperty.call(raw, 'completed_at')) payload.completed_at = null;
      if (completedField && completedField !== 'completed' && Object.prototype.hasOwnProperty.call(raw, completedField)) {
        payload[completedField] = appState.config.useStringCompleted ? 'false' : false;
      }
    }

    if (nextPanel === 'archived') {
      if (Object.prototype.hasOwnProperty.call(raw, 'archived')) payload.archived = true;
      payload.archived_at = new Date().toISOString();
    } else {
      if (Object.prototype.hasOwnProperty.call(raw, 'archived')) payload.archived = false;
      if (Object.prototype.hasOwnProperty.call(raw, 'archived_at')) payload.archived_at = null;
    }

    return payload;
  }

  function updateLocalTaskPanel(taskId, payload) {
    if (!taskId || !Array.isArray(appState?.tasks)) return;
    appState.tasks = appState.tasks.map(task => task?.id === taskId ? { ...task, ...payload } : task);
  }

  async function updateTaskPanel(task, nextPanel, reason = 'kitchenOpsPanelChange') {
    const taskId = task?.id || task?.raw?.id;
    if (!taskId || !nextPanel) return false;
    const guard = getRemoteWriteGuard('tasks');
    if (!guard.allowed) {
      showToast(guard.reason || 'Live connection is degraded. Task not updated.', 'warning', { durationMs: 2400 });
      setStatus(`Blocked task update: ${guard.reason || 'write path not ready'}`);
      return false;
    }

    const previousTasks = Array.isArray(appState.tasks) ? [...appState.tasks] : [];
    const payload = buildPanelPayload(task, nextPanel);
    updateLocalTaskPanel(taskId, payload);
    renderRuntimeUi({ renderDevConsole: false });

    const ioStartedAt = startIoOperation('writes', 'tasks', reason);
    try {
      const { error } = await appState.supabase
        .from(appState.config.taskTable || 'tasks')
        .update(payload)
        .eq('id', taskId);
      if (error) throw error;
      finishIoOperation('writes', 'tasks', ioStartedAt, { ok: true, reason });
      showToast(`Moved to ${KITCHEN_PANEL_OPTIONS.find(p => p.value === nextPanel)?.label || nextPanel}`, 'success', { durationMs: 1400 });
      setStatus(`Moved task: ${getTaskTitle(task)}`);
      return true;
    } catch (error) {
      finishIoOperation('writes', 'tasks', ioStartedAt, { ok: false, reason, error: error?.message || String(error) });
      appState.tasks = previousTasks;
      renderRuntimeUi({ renderDevConsole: false });
      console.error(error);
      showToast('Could not move task — restored locally', 'error', { durationMs: 2400 });
      setStatus(`Could not move task: ${error.message}`);
      return false;
    }
  }

  async function bulkUpdateSelectedTasks(context, nextPanel) {
    const ids = [...kitchenOpsSelectedTaskIds];
    if (!ids.length || !nextPanel) return;
    const taskById = new Map((context.digest.all || []).map(task => [task.id || task.raw?.id, task]));
    const targets = ids.map(id => taskById.get(id)).filter(Boolean);
    if (!targets.length) return;

    const guard = getRemoteWriteGuard('tasks');
    if (!guard.allowed) {
      showToast(guard.reason || 'Live connection is degraded. Tasks not updated.', 'warning', { durationMs: 2400 });
      setStatus(`Blocked bulk update: ${guard.reason || 'write path not ready'}`);
      return;
    }

    const previousTasks = Array.isArray(appState.tasks) ? [...appState.tasks] : [];
    const ioStartedAt = startIoOperation('writes', 'tasks', 'kitchenOpsBulkPanelChange');
    try {
      for (const task of targets) {
        const taskId = task.id || task.raw?.id;
        const payload = buildPanelPayload(task, nextPanel);
        updateLocalTaskPanel(taskId, payload);
        const { error } = await appState.supabase
          .from(appState.config.taskTable || 'tasks')
          .update(payload)
          .eq('id', taskId);
        if (error) throw error;
      }
      finishIoOperation('writes', 'tasks', ioStartedAt, { ok: true, rows: targets.length, reason: 'kitchenOpsBulkPanelChange' });
      kitchenOpsSelectedTaskIds.clear();
      kitchenOpsSelectMode = false;
      renderRuntimeUi({ renderDevConsole: false });
      showToast(`Moved ${targets.length} task${targets.length === 1 ? '' : 's'}`, 'success');
      setStatus(`Moved ${targets.length} selected task${targets.length === 1 ? '' : 's'}.`);
    } catch (error) {
      finishIoOperation('writes', 'tasks', ioStartedAt, { ok: false, reason: 'kitchenOpsBulkPanelChange', error: error?.message || String(error) });
      appState.tasks = previousTasks;
      renderRuntimeUi({ renderDevConsole: false });
      console.error(error);
      showToast('Could not bulk move tasks — restored locally', 'error', { durationMs: 2600 });
      setStatus(`Could not bulk move tasks: ${error.message}`);
    }
  }

  function buildModeSwitcher(context) {
    const wrap = document.createElement('section');
    wrap.className = 'kitchen-mode-switcher panel-card';
    const seg = document.createElement('div');
    seg.className = 'kitchen-mode-segmented';
    ['surface','tasks'].forEach(mode => {
      const btn = document.createElement('button');
      btn.className = `kitchen-mode-button ${kitchenViewMode === mode ? 'active' : ''}`;
      btn.textContent = mode === 'surface' ? 'Surface' : `Tasks (${context.digest.counts.all || 0})`;
      btn.onclick = () => {
        kitchenViewMode = mode;
        renderMode();
      };
      seg.append(btn);
    });
    wrap.append(seg);
    return wrap;
  }

  function buildRecentlyAddedCard(context) {
    const items = [...(context.digest.allItems || [])].slice(0, 6);
    return buildCard('Recently Added', 'Newest captured tasks stay visible', renderTaskList(items, 'No recent tasks.', { showPills: true }), 'panel-card');
  }

  function buildOpsToolbar(context, filtered) {
    const toolbar = document.createElement('section');
    toolbar.className = 'kitchen-ops-toolbar panel-card';

    const count = document.createElement('div');
    count.className = 'kitchen-ops-count';
    const selectedCount = kitchenOpsSelectedTaskIds.size;
    count.textContent = kitchenOpsSelectMode
      ? `${selectedCount} selected · ${filtered.length} shown`
      : `${filtered.length} task${filtered.length === 1 ? '' : 's'} shown`;

    const actions = document.createElement('div');
    actions.className = 'kitchen-ops-actions';

    const selectBtn = buildSecondaryButton(kitchenOpsSelectMode ? 'Done selecting' : 'Select', () => {
      kitchenOpsSelectMode = !kitchenOpsSelectMode;
      if (!kitchenOpsSelectMode) kitchenOpsSelectedTaskIds.clear();
      renderMode();
    });

    const selectAllBtn = buildSecondaryButton('Select shown', () => {
      filtered.forEach(task => {
        const id = task.id || task.raw?.id;
        if (id) kitchenOpsSelectedTaskIds.add(id);
      });
      kitchenOpsSelectMode = true;
      renderMode();
    });

    const clearBtn = buildSecondaryButton('Clear', () => {
      kitchenOpsSelectedTaskIds.clear();
      renderMode();
    });

    const bulkSelect = document.createElement('select');
    bulkSelect.className = 'kitchen-ops-select kitchen-ops-bulk-select';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Move selected…';
    bulkSelect.append(placeholder);
    KITCHEN_PANEL_OPTIONS.forEach(panel => {
      const opt = document.createElement('option');
      opt.value = panel.value;
      opt.textContent = panel.label;
      bulkSelect.append(opt);
    });
    bulkSelect.disabled = !kitchenOpsSelectedTaskIds.size;
    bulkSelect.onchange = async () => {
      const nextPanel = bulkSelect.value;
      bulkSelect.value = '';
      await bulkUpdateSelectedTasks(context, nextPanel);
    };

    actions.append(selectBtn);
    if (kitchenOpsSelectMode) actions.append(selectAllBtn, clearBtn, bulkSelect);
    toolbar.append(count, actions);
    return toolbar;
  }

  function buildOpsTaskRow(task) {
    const row = document.createElement('div');
    const taskId = task.id || task.raw?.id;
    const category = getEffectiveCategory(task);
    const selected = taskId && kitchenOpsSelectedTaskIds.has(taskId);
    row.className = ['kitchen-ops-row', `task-category-${category}`, selected ? 'selected' : '', kitchenOpsSelectMode ? 'select-mode' : ''].filter(Boolean).join(' ');

    const selectWrap = document.createElement('label');
    selectWrap.className = 'kitchen-ops-check-wrap';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'kitchen-ops-check';
    check.checked = !!selected;
    check.addEventListener('click', (event) => event.stopPropagation());
    check.addEventListener('change', () => {
      if (!taskId) return;
      if (check.checked) kitchenOpsSelectedTaskIds.add(taskId);
      else kitchenOpsSelectedTaskIds.delete(taskId);
      kitchenOpsSelectMode = kitchenOpsSelectedTaskIds.size > 0 || kitchenOpsSelectMode;
      renderMode();
    });
    selectWrap.append(check);

    const center = document.createElement('div');
    center.className = 'kitchen-ops-row-main';
    const title = document.createElement('div');
    title.className = 'kitchen-ops-row-title';
    title.textContent = getTaskTitle(task);

    const meta = document.createElement('div');
    meta.className = 'kitchen-ops-row-meta';
    const due = task.dueText || task.due_text || task.raw?.due_text || '';
    meta.textContent = [task.owner, category, task.panel, task.tag, due].filter(Boolean).join(' · ');
    center.append(title, meta);

    center.addEventListener('click', () => {
      if (kitchenOpsSelectMode) {
        if (!taskId) return;
        if (kitchenOpsSelectedTaskIds.has(taskId)) kitchenOpsSelectedTaskIds.delete(taskId);
        else kitchenOpsSelectedTaskIds.add(taskId);
        renderMode();
        return;
      }
      if (typeof completeTask === 'function') completeTask(getTaskRaw(task));
    });

    let startX = 0;
    let startY = 0;
    center.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      startY = event.clientY;
    });
    center.addEventListener('pointerup', (event) => {
      const dx = event.clientX - startX;
      const dy = Math.abs(event.clientY - startY);
      if (Math.abs(dx) > 70 && dy < 45 && typeof HCC?.ui?.openTaskEditModal === 'function') {
        HCC.ui.openTaskEditModal(getTaskRaw(task));
      }
    });

    const panelSelect = document.createElement('select');
    panelSelect.className = 'kitchen-ops-panel-select';
    KITCHEN_PANEL_OPTIONS.forEach(panel => {
      const opt = document.createElement('option');
      opt.value = panel.value;
      opt.textContent = panel.label;
      panelSelect.append(opt);
    });
    panelSelect.value = task.panel || 'upcoming';
    panelSelect.addEventListener('click', (event) => event.stopPropagation());
    panelSelect.addEventListener('change', async () => {
      const nextPanel = panelSelect.value;
      await updateTaskPanel(task, nextPanel);
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'kitchen-ops-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (typeof HCC?.ui?.openTaskEditModal === 'function') HCC.ui.openTaskEditModal(getTaskRaw(task));
    });

    const right = document.createElement('div');
    right.className = 'kitchen-ops-row-actions';
    right.append(panelSelect, editBtn);

    row.append(selectWrap, center, right);
    return row;
  }

  function buildOpsView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'kitchen-ops-view';

    const filterBar = document.createElement('section');
    filterBar.className = 'kitchen-ops-filterbar panel-card';

    const search = document.createElement('input');
    search.className = 'kitchen-ops-search';
    search.placeholder = 'Search tasks';
    search.value = kitchenOpsFilters.search;
    search.oninput = () => {
      kitchenOpsFilters.search = search.value;
      renderMode();
    };

    function buildSelect(key, values, label) {
      const select = document.createElement('select');
      select.className = 'kitchen-ops-select';
      const all = document.createElement('option');
      all.value = 'all';
      all.textContent = label;
      select.append(all);
      values.forEach(v => {
        if (!v) return;
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.append(opt);
      });
      select.value = kitchenOpsFilters[key] || 'all';
      select.onchange = () => {
        kitchenOpsFilters[key] = select.value;
        kitchenOpsSelectedTaskIds.clear();
        renderMode();
      };
      return select;
    }

    const tasks = context.digest.all || [];
    const owners = [...new Set(tasks.map(t => t.owner).filter(Boolean))].sort();
    const panels = [...new Set([...tasks.map(t => t.panel).filter(Boolean), ...KITCHEN_PANEL_OPTIONS.map(p => p.value)])].sort();
    const categories = [...new Set(tasks.map(t => getEffectiveCategory(t)).filter(Boolean))].sort();
    const tags = [...new Set(tasks.map(t => t.tag).filter(Boolean))].sort();

    filterBar.append(search, buildSelect('owner', owners, 'Owner'), buildSelect('panel', panels, 'State'), buildSelect('category', categories, 'Category'), buildSelect('tag', tags, 'Tag'));

    const filtered = tasks.filter(task => {
      const category = getEffectiveCategory(task);
      if (kitchenOpsFilters.owner !== 'all' && task.owner !== kitchenOpsFilters.owner) return false;
      if (kitchenOpsFilters.panel !== 'all' && task.panel !== kitchenOpsFilters.panel) return false;
      if (kitchenOpsFilters.category !== 'all' && category !== kitchenOpsFilters.category) return false;
      if (kitchenOpsFilters.tag !== 'all' && task.tag !== kitchenOpsFilters.tag) return false;
      if (kitchenOpsFilters.search) {
        const hay = [getTaskTitle(task), task.description, task.tag, task.owner, category, task.panel].join(' ').toLowerCase();
        if (!hay.includes(kitchenOpsFilters.search.toLowerCase())) return false;
      }
      return true;
    });

    const list = document.createElement('div');
    list.className = 'kitchen-ops-list panel-card';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'kitchen-ops-empty';
      empty.textContent = 'No tasks match these filters.';
      list.append(empty);
    } else {
      filtered.slice(0, 140).forEach(task => list.append(buildOpsTaskRow(task)));
      if (filtered.length > 140) {
        const more = document.createElement('div');
        more.className = 'kitchen-ops-more';
        more.textContent = `Showing first 140 of ${filtered.length}. Narrow the filters to keep this fast.`;
        list.append(more);
      }
    }

    wrap.append(filterBar, buildOpsToolbar(context, filtered), list);
    return wrap;
  }

  function buildTopStrip(context) {
    const strip = document.createElement('section');
    strip.className = 'kitchen-top-strip panel-card';

    const left = document.createElement('div');
    left.className = 'kitchen-top-strip-main';
    const title = document.createElement('div');
    title.className = 'kitchen-top-strip-title';
    title.textContent = buildKitchenHeadline(context.digest);
    const meta = document.createElement('div');
    meta.className = 'kitchen-top-strip-meta';
    const now = getNowDate();
    meta.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    left.append(title, meta);

    const right = document.createElement('div');
    right.className = 'kitchen-top-strip-side';

    const weather = getSnapshotPayload(appState.config.weatherSnapshotType) || null;
    const weatherBox = document.createElement('div');
    weatherBox.className = 'kitchen-top-chip';
    const weatherLabel = document.createElement('div');
    weatherLabel.className = 'kitchen-top-chip-label';
    weatherLabel.textContent = 'Weather';
    const weatherValue = document.createElement('div');
    weatherValue.className = 'kitchen-top-chip-value';
    weatherValue.textContent = weather?.summary || weather?.locationName || '—';
    weatherBox.append(weatherLabel, weatherValue);

    const nextEvent = (context.digest.allEventItems || [])[0] || null;
    const eventBox = document.createElement('div');
    eventBox.className = 'kitchen-top-chip';
    const eventLabel = document.createElement('div');
    eventLabel.className = 'kitchen-top-chip-label';
    eventLabel.textContent = 'Next Event';
    const eventValue = document.createElement('div');
    eventValue.className = 'kitchen-top-chip-value';
    eventValue.textContent = nextEvent ? [nextEvent.title, nextEvent.meta].filter(Boolean).join(' · ') : 'No events queued';
    eventBox.append(eventLabel, eventValue);

    right.append(weatherBox, eventBox);
    strip.append(left, right);
    return strip;
  }

  function buildQuickActions(context) {
    const wrap = document.createElement('section');
    wrap.className = 'kitchen-quick-strip panel-card';

    const row = document.createElement('div');
    row.className = 'kitchen-quick-strip-row';

    row.append(
      buildSecondaryButton(`All Tasks (${context.digest.counts.all || 0})`, () => openQuickView('All Tasks', context.digest.allItems, 'No active tasks right now.')),
      buildSecondaryButton(`All Events (${(context.digest.allEventItems || []).length})`, () => openQuickView('All Events', context.digest.allEventItems, 'No calendar items loaded yet.')),
      buildSecondaryButton('Refresh', () => refreshAll('kitchen quick refresh')),
      buildSecondaryButton('Settings', () => openSettingsDialog())
    );

    wrap.append(row);
    return wrap;
  }

  HCC.surfaces.kitchen.renderSurface = function renderKitchenSurface(context) {
    const root = document.createElement('div');
    root.className = 'kitchen-command-surface';

    const top = buildTopStrip(context);
    const switcher = buildModeSwitcher(context);

    const columns = document.createElement('div');
    columns.className = 'kitchen-command-columns';

    const left = document.createElement('div');
    left.className = 'kitchen-command-column kitchen-command-column-left';
    const right = document.createElement('div');
    right.className = 'kitchen-command-column kitchen-command-column-right';

    left.append(
      HCC.surfaces.kitchen.buildBestNextCard(context),
      buildQuickActions(context),
      buildRecentlyAddedCard(context),
      HCC.surfaces.kitchen.buildTodayTasksCard(context)
    );

    right.append(
      HCC.surfaces.kitchen.buildEventsCard(context),
      HCC.surfaces.kitchen.buildSignalsCard(context),
      HCC.surfaces.kitchen.buildUpcomingCard(context)
    );

    columns.append(left, right);
    root.append(top, switcher);

    if (kitchenViewMode === 'tasks') {
      root.append(buildOpsView(context));
      return root;
    }

    root.append(columns);
    return root;
  };

  HCC.surfaces.kitchen.buildSummaryCard = function buildSummaryCard(context) {
    return buildTopStrip(context);
  };

  HCC.surfaces.kitchen.buildBestNextCard = function buildBestNextCard(context) {
    const spotlightItems = context.digest.spotlightTasks || (context.digest.spotlightTask ? [context.digest.spotlightTask] : []);
    return buildCard('Best Next', 'Do this next', renderSpotlightCard(spotlightItems), 'kitchen-bestnext-card panel-card panel-focus-card');
  };

  HCC.surfaces.kitchen.buildEventsCard = function buildEventsCard(context) {
    const items = (context.digest.allEventItems || []).slice(0, 5);
    return buildCard('Events', `${context.digest.counts.eventsToday || 0} today`, renderTaskList(items, 'No calendar items loaded yet.', { showPills: true }), 'kitchen-events-card panel-card');
  };

  HCC.surfaces.kitchen.buildTodayTasksCard = function buildTodayTasksCard(context) {
    const items = (context.digest.todayTasks || []).slice(0, 6);
    return buildCard('Today Tasks', `${context.digest.counts.today || 0} on deck`, renderTaskList(items, 'Nothing due today right now.', { showPills: true }), 'kitchen-tasks-card panel-card panel-today-card');
  };

  HCC.surfaces.kitchen.buildSignalsCard = function buildSignalsCard(context) {
    const count = (context.signals || []).length;
    return buildCard('Needs Attention', count ? `${count} visible · tap to arm · swipe for detail` : 'Everything looks calm right now.', renderSignalActionList((context.signals || []).slice(0, 6), 'Everything looks calm right now.'), 'kitchen-signals-card panel-card panel-signals-card');
  };

  HCC.surfaces.kitchen.buildUpcomingCard = function buildUpcomingCard(context) {
    return buildCard('Coming Up', `${context.digest.upcomingTasks.length || 0} queued`, renderTaskList((context.digest.upcomingTasks || []).slice(0, 8), 'Nothing is queued up soon.', { showPills: true }), 'kitchen-upcoming-card panel-card panel-upcoming-card');
  };
})();

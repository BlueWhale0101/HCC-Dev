const SURFACE_DEFINITIONS = {
  kitchen: {
    bodyClasses: ['widget-surface', 'kitchen-surface'],
    screenClass: 'screen two-columns widget-layout widget-layout-kitchen',
    widgets: [
      'context',
      'quickActions',
      'kitchenHeader',
      'signals',
      'forget',
      'spotlight',
      'upcoming',
    ],
  },
  tv: {
    bodyClasses: ['widget-surface', 'tv-surface'],
    screenClass: 'screen single-column widget-layout widget-layout-tv',
    widgets: ['tvHero', 'tvSignals', 'tvToday', 'tvMotion', 'tvForget'],
  },
  laundry: {
    bodyClasses: ['widget-surface', 'laundry-surface'],
    screenClass: 'screen single-column widget-layout widget-layout-laundry',
    widgets: ['laundrySummary', 'laundryLoads'],
  },
  bedroom: {
    bodyClasses: ['widget-surface', 'bedroom-surface'],
    screenClass: 'screen single-column bedroom-layout widget-layout widget-layout-bedroom',
    widgets: ['bedroomHeader', 'bedroomBestNext', 'bedroomNextEvent', 'bedroomSignal'],
  },
  mobile: {
    bodyClasses: ['mobile-surface'],
    screenClass: 'screen two-columns widget-layout widget-layout-mobile',
    widgets: ['today', 'laundryLoads', 'upcoming', 'recentLogs', 'signals', 'quickActions', 'context', 'taskMapping'],
  },
};

const SURFACE_BODY_CLASS_NAMES = ['tv-mode', 'mobile-mode', 'widget-surface', 'tv-surface', 'kitchen-surface', 'laundry-surface', 'bedroom-surface', 'mobile-surface'];

function getSurfaceDefinition(mode) {
  return SURFACE_DEFINITIONS[mode] || SURFACE_DEFINITIONS.kitchen;
}

function applySurfaceBodyClasses(mode) {
  const surface = getSurfaceDefinition(mode);
  for (const className of SURFACE_BODY_CLASS_NAMES) {
    document.body.classList.remove(className);
  }
  for (const className of surface.bodyClasses || []) {
    document.body.classList.add(className);
  }
  document.body.classList.toggle('tv-mode', mode === 'tv');
  document.body.classList.toggle('mobile-mode', mode === 'mobile');
}

function renderMode() {
  const mode = appState.config.mode || 'tv';
  applySurfaceBodyClasses(mode);
  const digest = buildTaskDigest();
  const widgetContext = buildWidgetContext(digest);
  if (mode === 'mobile') {
    renderMobileControlPanel(widgetContext);
    updateCalendarAuthBanner();
    return;
  }
  renderModeLayout(mode, widgetContext);
  updateCalendarAuthBanner();
}

function buildWidgetContext(digest) {
  const signals = activeSignals();
  const tomorrowItems = buildTomorrowItemsFromDigest(digest);
  const forgetItems = buildForgetItemsFromSignals(signals, tomorrowItems, digest);
  return {
    mode: appState.config.mode,
    digest,
    signals,
    tomorrowItems,
    forgetItems,
    focusItem: buildSoftFocusFromDigest(digest, signals),
    isEvening: isEvening(),
    presentationPhase: getPresentationPhase(),
  };
}

function renderModeLayout(mode, context) {
  const layout = getSurfaceDefinition(mode);
  screenEl.className = layout.screenClass;
  screenEl.replaceChildren();

  const ambientFooter = (mode !== 'mobile' && mode !== 'bedroom') ? buildAmbientFooter() : null;

  if (mode === 'tv') {
    const tvWrap = document.createElement('div');
    tvWrap.className = 'tv-layout tv-layout-wide';
    for (const widgetId of layout.widgets) {
      const node = renderWidget(widgetId, context);
      if (node) tvWrap.append(node);
    }
    screenEl.append(tvWrap);
    if (ambientFooter) screenEl.append(ambientFooter);
    return;
  }

  for (const widgetId of layout.widgets) {
    const node = renderWidget(widgetId, context);
    if (node) screenEl.append(node);
  }

  if (ambientFooter) screenEl.append(ambientFooter);
}

function renderWidget(widgetId, context) {
  const widget = WIDGETS[widgetId];
  if (!widget) {
    pushDevLog('warn', `Unknown widget: ${widgetId}`);
    return null;
  }
  return widget(context);
}

const WIDGETS = {
  kitchenHeader: (context) => buildKitchenTodayCard(context),
  today: (context) => buildCard('Today', '', renderTaskList(context.digest.todayTasks, 'No tasks visible.', { showPills: true }), 'panel-card panel-today-card'),
  spotlight: (context) => buildCard('Best Next Move', 'Most useful thing to do next', renderSpotlightCard(context.digest.spotlightTasks || (context.digest.spotlightTask ? [context.digest.spotlightTask] : []))),
  signals: (context) => buildCard('Needs Attention', `${context.signals.length} visible`, renderSignalActionList(context.signals.slice(0, 6), 'Everything looks calm right now.'), 'panel-card panel-signals-card'),
  upcoming: (context) => buildCard('Coming Up', `${context.digest.upcomingTasks.length} coming soon`, renderTaskList(context.digest.upcomingTasks.slice(0, 6), 'Nothing is queued up soon.', { showPills: true }), 'panel-card panel-upcoming-card'),
  quickActions: () => buildQuickActionsCard(),
  forget: (context) => buildCard('Don’t Forget', 'Coming up soon', renderTaskList(context.forgetItems, 'Nothing important is coming up yet.', { showPills: true }), 'panel-card panel-reminders-card'),
  context: () => buildCard('Weather & Next Event', 'Context for the day', renderContextStack()),
  taskMapping: () => buildCard('Task Mapping', 'Live field mapping for this board', renderTaskMappingSummary()),
  tvHero: () => buildTvHero(),
  tvToday: (context) => buildCard(context.isEvening ? 'Today + Tomorrow' : 'Today', context.isEvening ? 'Evening preview is starting to fold in tomorrow' : '', renderTaskList(buildTvTodayItems(context), 'Nothing major on the board.', { compact: true, showPills: true }), 'tv-card tv-tall-card panel-card panel-today-card'),
  tvSignals: (context) => buildCard('Attention', '', renderList(context.signals.slice(0, 4).map(signalToItem), 'House is in a good place.'), 'tv-card tv-tall-card panel-card panel-signals-card'),
  tvMotion: (context) => buildCard('In Motion', context.digest.counts.inMotion ? `${context.digest.counts.inMotion} active` : '', renderTaskList(context.digest.inMotionTasks.slice(0, 5), 'Nothing is actively in motion right now.', { compact: true, showPills: true }), 'tv-card tv-tall-card panel-card panel-focus-card'),
  tvForget: (context) => buildCard('Don’t Forget', 'Tomorrow and coming up soon', renderTaskList(context.forgetItems.slice(0, 4), 'Nothing important is coming up soon.', { compact: true, showPills: true }), 'tv-card tv-bottom-card panel-card panel-reminders-card'),
  laundrySummary: () => buildCard('Laundry Status', 'Tap a load to move it forward', renderLaundrySummary(), 'laundry-summary-card'),
  laundryLoads: () => buildCard('Loads In Progress', 'Washer, dryer, and ready-to-fold loads', renderLaundryLoads(), 'laundry-loads-card'),
  laundrySignals: () => buildCard('Laundry Signals', 'Useful reminders for the workflow', renderLaundrySignals(), 'laundry-signals-card'),
  bedroomHeader: () => buildBedroomHeaderStrip(),
  bedroomBestNext: (context) => buildBedroomBestNextCard(context),
  bedroomNextEvent: (context) => buildBedroomNextEventCard(context),
  bedroomSignal: (context) => buildBedroomSignalCard(context),
  recentLogs: () => buildCard('Recent Logs', '', renderList(appState.logs.map(logToItem), 'No quick logs yet.')),
};


function buildBedroomHeaderStrip() {
  const section = document.createElement('section');
  section.className = 'bedroom-header-strip';

  const left = document.createElement('div');
  left.className = 'bedroom-header-left';

  const date = document.createElement('div');
  date.className = 'bedroom-header-date';
  date.textContent = getNowDate().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const phase = document.createElement('div');
  phase.className = 'bedroom-header-phase';
  phase.textContent = isEvening() ? 'Tomorrow view' : 'Today view';

  left.append(date, phase);

  const right = document.createElement('div');
  right.className = 'bedroom-header-right';

  const timeEl = document.createElement('div');
  timeEl.className = 'bedroom-header-time';
  timeEl.textContent = getNowDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const health = getAmbientHealthState();
  const statusButton = document.createElement('button');
  statusButton.type = 'button';
  statusButton.className = `bedroom-status-pill bedroom-status-${health.level}`;
  statusButton.textContent = health.level === 'degraded' ? 'Needs attention' : health.level === 'aging' ? 'Slightly behind' : 'Healthy';
  statusButton.setAttribute('aria-label', 'System status');
  statusButton.title = 'Tap for trust details and version';
  statusButton.addEventListener('click', () => {
    if (typeof openBedroomStatusModal === 'function') openBedroomStatusModal();
  });

  right.append(timeEl, statusButton);
  section.append(left, right);
  return section;
}

function makeBedroomInteractiveCard(card, item, kind) {
  if (!item) return card;
  card.classList.add('bedroom-interactive-card');
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  const open = () => {
    if (typeof openBedroomItemModal === 'function') openBedroomItemModal(item, { kind });
  };
  card.addEventListener('click', (event) => {
    event.preventDefault();
    open();
  });
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function buildBedroomBestNextCard(context) {
  const primary = context?.digest?.spotlightTask || null;
  const body = primary
    ? renderSpotlightCard([primary])
    : buildEmptyState(`Nothing big for ${context?.isEvening ? 'tomorrow' : 'today'} yet.`);
  const subtitle = context?.isEvening ? 'Best thing to set up for tomorrow' : 'Best thing to do next';
  const card = buildCard('Best Next', subtitle, body, 'panel-card bedroom-best-next-card');
  if (primary?.categoryKey) card.classList.add('bedroom-category-shell', `spotlight-category-${primary.categoryKey}`);
  return makeBedroomInteractiveCard(card, primary, 'task');
}

function selectBedroomNextEvent(context) {
  const todayItems = context?.digest?.calendarTodayItems || [];
  const tomorrowItems = context?.digest?.calendarTomorrowItems || [];
  if (context?.isEvening && !todayItems.length) return tomorrowItems[0] || null;
  return todayItems[0] || tomorrowItems[0] || null;
}

function buildBedroomNextEventCard(context) {
  const nextEvent = selectBedroomNextEvent(context);
  const subtitle = context?.isEvening ? 'Next thing on the calendar' : 'Coming up next';
  const body = nextEvent
    ? renderTaskList([{ ...nextEvent, actionHint: 'Open event details' }], 'No calendar items are loaded yet.', { showPills: true })
    : buildEmptyState('Nothing on the calendar yet.');
  const card = buildCard('Next Event', subtitle, body, 'panel-card bedroom-next-event-card');
  if (nextEvent?.categoryKey) card.classList.add('bedroom-category-shell', `spotlight-category-${nextEvent.categoryKey}`);
  return makeBedroomInteractiveCard(card, nextEvent, 'event');
}

function buildBedroomSignalCard(context) {
  const topSignal = Array.isArray(context?.signals) ? context.signals[0] : null;
  const signalItem = topSignal ? signalToItem(topSignal) : null;
  const body = signalItem
    ? renderTaskList([{ ...signalItem, actionHint: 'Open signal details' }], 'Nothing needs attention right now.', { showPills: true })
    : buildEmptyState('Nothing needs attention right now.');
  const card = buildCard('Signal', 'One thing to keep in mind', body, 'panel-card bedroom-signal-card');
  if (topSignal?.severity) card.classList.add(`bedroom-signal-severity-${topSignal.severity}`);
  return makeBedroomInteractiveCard(card, signalItem || topSignal, 'signal');
}

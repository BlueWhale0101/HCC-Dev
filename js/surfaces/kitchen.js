window.HCC = window.HCC || {};
window.HCC.surfaces = window.HCC.surfaces || {};
window.HCC.surfaces.kitchen = window.HCC.surfaces.kitchen || {};

HCC.surfaces.kitchen.buildSummaryCard = function buildSummaryCard(context) {
  const wrap = document.createElement('div');
  wrap.className = 'kitchen-summary-wrap';

  const headline = document.createElement('div');
  headline.className = 'kitchen-summary-headline';
  headline.textContent = buildKitchenHeadline(context.digest);

  const stats = document.createElement('div');
  stats.className = 'kitchen-summary-stats';
  [
    ['Tasks', context.digest.counts.all || 0],
    ['Today', context.digest.counts.today || 0],
    ['Events', (context.digest.calendarTodayItems || []).length + (context.digest.calendarTomorrowItems || []).length],
    ['Signals', (context.signals || []).length],
  ].forEach(([label, value]) => stats.append(buildPill(`${label} ${value}`, 'kitchen-stat-pill')));

  const actions = document.createElement('div');
  actions.className = 'inline-action-row';
  const allTasksBtn = document.createElement('button');
  allTasksBtn.className = 'secondary-button mini-button';
  allTasksBtn.textContent = `All Tasks (${context.digest.counts.all})`;
  allTasksBtn.addEventListener('click', () => openQuickView('All Tasks', context.digest.allItems, 'No active tasks right now.'));
  const allEventsBtn = document.createElement('button');
  allEventsBtn.className = 'secondary-button mini-button';
  allEventsBtn.textContent = `All Events (${context.digest.allEventItems.length})`;
  allEventsBtn.addEventListener('click', () => openQuickView('All Events', context.digest.allEventItems, 'No calendar items loaded yet.'));
  actions.append(allTasksBtn, allEventsBtn);
  wrap.append(headline, stats, actions, renderContextStack());
  return buildCard('Kitchen', 'Action-first overview', wrap, 'kitchen-summary-card');
};

HCC.surfaces.kitchen.buildBestNextCard = function buildBestNextCard(context) {
  const spotlightItems = context.digest.spotlightTasks || (context.digest.spotlightTask ? [context.digest.spotlightTask] : []);
  return buildCard('Best Next', 'Do this next', renderSpotlightCard(spotlightItems), 'kitchen-bestnext-card panel-card panel-focus-card');
};

HCC.surfaces.kitchen.buildEventsCard = function buildEventsCard(context) {
  return buildCard('Events', `${context.digest.counts.eventsToday || 0} today`, renderTaskList((context.digest.allEventItems || []).slice(0, 6), 'No calendar items loaded yet.', { showPills: true }), 'kitchen-events-card panel-card');
};

HCC.surfaces.kitchen.buildTodayTasksCard = function buildTodayTasksCard(context) {
  return buildCard('Today Tasks', `${context.digest.counts.today || 0} on deck`, renderTaskList((context.digest.todayTasks || []).slice(0, 6), 'Nothing due today right now.', { showPills: true }), 'kitchen-tasks-card panel-card panel-today-card');
};

HCC.surfaces.kitchen.buildSignalsCard = function buildSignalsCard(context) {
  const count = (context.signals || []).length;
  return buildCard('Needs Attention', count ? `${count} visible · tap to arm · swipe for detail` : 'Everything looks calm right now.', renderSignalActionList((context.signals || []).slice(0, 6), 'Everything looks calm right now.'), 'kitchen-signals-card panel-card panel-signals-card');
};

HCC.surfaces.kitchen.buildUpcomingCard = function buildUpcomingCard(context) {
  return buildCard('Coming Up', `${context.digest.upcomingTasks.length || 0} queued`, renderTaskList((context.digest.upcomingTasks || []).slice(0, 8), 'Nothing is queued up soon.', { showPills: true }), 'kitchen-upcoming-card panel-card panel-upcoming-card');
};

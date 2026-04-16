window.HCC = window.HCC || {};
HCC.tasks = HCC.tasks || {};

HCC.tasks.CATEGORY_DEFINITIONS = [
  {
    key: 'work_skye',
    label: 'Skye Work',
    pattern: /(skye work|photo paper|photo printer|portfolio|memory cards?|adobe( cloud)?|framing|mat boards?|photo(?:graphy|s)?|photo shoot|client gallery|editing session|printer|archived photos?|luster|semigloss|frame(?:\b|ing))/,
  },
  {
    key: 'child',
    label: 'Child',
    pattern: /(\btor\b|torben|\bboo\b|kindy|kindergarten|school run|toy library|playgroup|play group|daycare|day care|childcare|child care|preschool|pre-school|drop ?off|pickup|pick up|lunchbox|backpack|uniform|teacher|class(?:room)?|playroom|toys?\b|kids?\b|child\b|birthday|drawings?|travel cot)/,
  },
  {
    key: 'travel',
    label: 'Travel',
    pattern: /(flight|flights|hotel|airbnb|airport|transfers?|transport|trip|travel|sydney|olympic park|reservation|itinerary|boarding|book .*hotel|book .*flight|book .*airbnb)/,
  },
  {
    key: 'fitness',
    label: 'Fitness',
    pattern: /(hyrox|crossfit|aquatic centre|recovery session|workout|gym|training|train\b|race day|race\b)/,
  },
  {
    key: 'garden',
    label: 'Garden',
    pattern: /(garden|plants?\b|drippers?|hose|front yard|weed(?: killer)?|sprayer|yard\b|soil|pots?\b|watering|dig plants|killer front yard)/,
  },
  {
    key: 'creative',
    label: 'Creative',
    pattern: /(opera|concert|woodwork(?:ing)?|reading|cricut|design(?:ing)?|jazz|tshirts?|t-shirts?|shirts?\b|great opera hits|opera house)/,
  },
  {
    key: 'project',
    label: 'Project',
    pattern: /(garden board|homecommandcenter|device\b|setup (?:tv|kitchen|bedroom|laundry)|realtime|task board|app\b|debug|sync\b|version\b|mounting .*device|add colour to tasks)/,
  },
  {
    key: 'errand',
    label: 'Errand',
    pattern: /(buy\b|shopping|shop\b|store\b|post office|library\b|woolies|pharmacy|kmart|redeem|pickup|pick up|collect\b|get another|parts list|pick up package)/,
  },
  {
    key: 'admin',
    label: 'Admin',
    pattern: /(call\b|email\b|message\b|report\b|schedule\b|appointment|pay\b|rego|bill\b|police|gardeners?|doctor|dentist|counseling|paperwork|forms?\b|connect to)/,
  },
  {
    key: 'home',
    label: 'Home',
    pattern: /(laundry|clean\b|cleaning|dishes|bins\b|trash|garbage|fold\b|dryer|washer|kitchen\b|bed(?:room)?\b|organize|storage|shed\b|patio|windowsills?|doors?\b|light switches|vacuum|rug\b|pillows?|gazebo|desk\b|sideboard|cord\b|walls?\b|robot vacuum|shower|windows?\b|sliding doors|pool storage|outdoor)/,
  },
];

HCC.tasks.getCategorySearchParts = function getCategorySearchParts(item) {
  return [
    item?.tag,
    item?.title,
    item?.description,
    item?.sourceLabel,
    item?.location,
    item?.calendarSummary,
  ].filter(Boolean).map((value) => String(value));
};

HCC.tasks.inferCategoryDetails = function inferCategoryDetails(item = {}) {
  const defs = HCC.tasks.CATEGORY_DEFINITIONS || [];
  const searchParts = HCC.tasks.getCategorySearchParts(item);
  const normalizedParts = searchParts.map((part) => part.toLowerCase());
  const haystack = normalizedParts.join(' ').trim();

  if (!haystack) {
    return {
      key: 'general',
      label: HCC.tasks.getCategoryLabel ? HCC.tasks.getCategoryLabel('general') : 'General',
      matchedRule: 'fallback:empty',
      matchedText: '',
      confidence: 0,
      sourceText: searchParts.join(' · '),
    };
  }

  for (const def of defs) {
    if (!def.pattern) continue;
    const match = haystack.match(def.pattern);
    if (!match) continue;
    return {
      key: def.key,
      label: def.label,
      matchedRule: `pattern:${def.key}`,
      matchedText: match[0] || '',
      confidence: 0.92,
      sourceText: searchParts.join(' · '),
    };
  }

  return {
    key: 'general',
    label: HCC.tasks.getCategoryLabel ? HCC.tasks.getCategoryLabel('general') : 'General',
    matchedRule: 'fallback:general',
    matchedText: '',
    confidence: 0.2,
    sourceText: searchParts.join(' · '),
  };
};

HCC.tasks.applyCategoryMetadata = function applyCategoryMetadata(item = {}) {
  const details = HCC.tasks.inferCategoryDetails(item);
  return {
    ...item,
    category: details.key,
    categoryDebug: details,
  };
};

HCC.tasks.inferCategory = function inferCategory(item) {
  return HCC.tasks.inferCategoryDetails(item).key;
};

HCC.tasks.getCategoryLabel = function getCategoryLabel(category) {
  const defs = HCC.tasks.CATEGORY_DEFINITIONS || [];
  const match = defs.find((item) => item.key === category);
  return match?.label || 'General';
};

HCC.tasks.scoreTask = function scoreTask(task, context) {
  const now = context?.now || new Date();
  const dueBucket = context?.dueBucket || 'undated';
  const windowName = context?.windowName || 'today';
  const evening = !!context?.evening;
  let score = 0;

  if (windowName === 'today') {
    if (dueBucket === 'today') score += 42;
    else if (dueBucket === 'overdue') score += 46;
    else if (dueBucket === 'tomorrow') score += evening ? 14 : 6;
    else if (dueBucket === 'future') score -= 10;
    else if (dueBucket === 'undated') score -= 16;
  } else if (windowName === 'tomorrow') {
    if (dueBucket === 'tomorrow') score += 44;
    else if (dueBucket === 'today') score += evening ? 14 : 2;
    else if (dueBucket === 'overdue') score += 4;
    else if (dueBucket === 'future') score -= 8;
    else if (dueBucket === 'undated') score -= 16;
  }

  if (typeof isInMotionPanel === 'function' && isInMotionPanel(task?.panel)) score += 30;
  if (task?.recurrence) score += 4;
  if (task?.isMine) score += 2;

  if (task?.createdAt) {
    const createdAt = new Date(task.createdAt).getTime();
    if (Number.isFinite(createdAt)) {
      const ageHours = (now.getTime() - createdAt) / 3600000;
      if (ageHours <= 24) score += 6;
      else if (ageHours <= 72) score += 3;
    }
  }

  if (task?.dueDate) {
    const dueMs = task.dueDate.getTime();
    const nowMs = now.getTime();
    const ageDays = (nowMs - dueMs) / 86400000;
    if (dueBucket === 'overdue' && ageDays > 3) {
      score -= Math.min(28, Math.floor((ageDays - 3) * 4));
    }
    const distanceDays = Math.abs(dueMs - nowMs) / 86400000;
    score += Math.max(0, 5 - Math.floor(distanceDays));
  }

  return score;
};

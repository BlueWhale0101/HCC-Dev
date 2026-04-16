
window.HCC = window.HCC || {};
HCC.tasks = HCC.tasks || {};

HCC.tasks.inferCategory = function inferCategory(task) {
  const parts = [task?.tag, task?.title, task?.description].filter(Boolean).join(' ').toLowerCase();
  if (!parts) return 'general';
  if (/(laundry|clean|dishes|bins|trash|garbage|fold|dryer|washer|kitchen|bed)/.test(parts)) return 'home';
  if (/(call|email|book|schedule|appointment|meeting|doctor|dentist|paperwork|form|admin)/.test(parts)) return 'admin';
  if (/(buy|shop|shopping|pickup|pick up|store|grocer|grocery|pharmacy|post office|library|errand)/.test(parts)) return 'errand';
  if (/(school|daycare|kid|kids|hyrox|workout|gym|train|practice|trip|travel|pack)/.test(parts)) return 'planning';
  return 'general';
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

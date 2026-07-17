export function safeToPlan(income: number, spent: number, committed: number) {
  return Math.max(0, income - spent - committed);
}

export function monthProgress(date: Date) {
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(1, Math.max(0, date.getDate() / days));
}

export function spendingPace(spent: number, income: number, progress: number) {
  if (income <= 0) return "unknown" as const;
  const used = spent / income;
  if (used > 1) return "over" as const;
  if (used > progress + 0.12) return "attention" as const;
  return "on_track" as const;
}

export function monthlyGoalNeed(current: number, target: number, deadline: string | null, today: Date) {
  const remaining = Math.max(0, target - current);
  if (!deadline || remaining === 0) return null;
  const end = new Date(`${deadline}T12:00:00`);
  if (Number.isNaN(end.getTime()) || end <= today) return remaining;
  const months = Math.max(1, (end.getFullYear() - today.getFullYear()) * 12 + end.getMonth() - today.getMonth() + 1);
  return remaining / months;
}

export function splitInstallments(total: number, count: number) {
  if (!Number.isFinite(total) || total <= 0) throw new Error("Total inválido.");
  if (!Number.isInteger(count) || count < 1 || count > 60) throw new Error("Quantidade de parcelas inválida.");
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

export function addMonthsToDate(date: string, offset: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Data inválida.");
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const targetMonth = month - 1 + offset;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function allocateInstallmentShares(
  installmentAmounts: number[],
  shares: { userId: string; percentage: number }[],
) {
  const installmentCents = installmentAmounts.map((amount) => Math.round(amount * 100));
  const totalCents = installmentCents.reduce((sum, amount) => sum + amount, 0);
  const capacity = [...installmentCents];

  return shares.map((share) => {
    const desired = Math.min(
      Math.round(totalCents * (share.percentage / 100)),
      capacity.reduce((sum, amount) => sum + amount, 0),
    );
    const cents = installmentCents.map((amount, index) => Math.min(
      Math.floor(amount * (share.percentage / 100)),
      capacity[index],
    ));
    let remainder = desired - cents.reduce((sum, amount) => sum + amount, 0);

    while (remainder > 0) {
      let allocated = false;
      for (let index = 0; index < cents.length && remainder > 0; index += 1) {
        const available = capacity[index] - cents[index];
        if (available <= 0) continue;
        cents[index] += 1;
        remainder -= 1;
        allocated = true;
      }
      if (!allocated) break;
    }

    cents.forEach((amount, index) => { capacity[index] -= amount; });
    return { userId: share.userId, amounts: cents.map((amount) => amount / 100) };
  });
}

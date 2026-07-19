import Link from "next/link";
import { brl } from "@/lib/format";
import { getContext } from "@/lib/profiles";

type Row = { id: string; occurred_at: string; amount: number; description: string | null; transaction_type: string };
const pad = (value: number) => String(value).padStart(2, "0");

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const { supabase, active } = await getContext();
  if (!active) return null;
  const params = await searchParams;
  const now = new Date();
  const selected = /^\d{4}-\d{2}$/.test(params.mes ?? "") ? String(params.mes) : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const [year, month] = selected.split("-").map(Number);
  const first = `${selected}-01`;
  const last = `${selected}-${pad(new Date(year, month, 0).getDate())}`;
  const { data } = await supabase.from("transactions").select("id,occurred_at,amount,description,transaction_type")
    .eq("profile_id", active.id).eq("status", "confirmed").gte("occurred_at", first).lte("occurred_at", last).order("occurred_at");
  const rows = (data ?? []) as Row[];
  const day = params.dia && params.dia.startsWith(selected) ? params.dia : null;
  const dayRows = day ? rows.filter((row) => row.occurred_at === day) : [];
  const date = new Date(year, month - 1, 1);
  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
  const blanks = Array.from({ length: date.getDay() }, (_, i) => i);
  return <div className="flex flex-col gap-4">
    <header><p className="eyebrow">Agenda financeira</p><h1 className="page-title">Calendário</h1></header>
    <section className="card">
      <div className="month-switch"><Link href={`/calendario?mes=${key(prev)}`} aria-label="Mês anterior">‹</Link><strong>{date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><Link href={`/calendario?mes=${key(next)}`} aria-label="Próximo mês">›</Link></div>
      <div className="calendar-grid mt-4"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
        {blanks.map((value) => <i key={`blank-${value}`} />)}
        {days.map((number) => { const value = `${selected}-${pad(number)}`; const dayItems = rows.filter((row) => row.occurred_at === value); const income = dayItems.some((row) => ["income", "transfer_in"].includes(row.transaction_type)); const expense = dayItems.some((row) => ["expense", "transfer_out", "card_payment"].includes(row.transaction_type)); return <Link key={value} className={`calendar-day ${day === value ? "calendar-day-active" : ""}`} href={`/calendario?mes=${selected}&dia=${value}`}><b>{number}</b><span>{income && <i className="dot-income" />}{expense && <i className="dot-expense" />}</span></Link>; })}
      </div>
    </section>
    {day && <section className="card"><h2 className="section-title">{new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}</h2><div className="compact-list mt-3">{dayRows.length ? dayRows.map((row) => <Link href={`/extrato?editar=${row.id}`} className="compact-row" key={row.id}><span><strong className="block text-sm">{row.description ?? "Lançamento"}</strong><small className="text-muted">{row.transaction_type}</small></span><strong data-money>{brl(row.amount)}</strong></Link>) : <p className="empty-calm text-sm text-muted">Nada lançado neste dia.</p>}</div></section>}
  </div>;
}

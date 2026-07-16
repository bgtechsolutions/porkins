import Link from "next/link";
import { redirect } from "next/navigation";
import { brl } from "@/lib/format";
import { getContext } from "@/lib/profiles";
import { EmpresaTabs } from "./EmpresaTabs";

export const dynamic = "force-dynamic";
type Receivable = { id:string; revenue_type:string; description:string; amount:number; due_date:string; status:string; client_id:string };
type Payable = { id:string; amount:number; status:string; user_id:string };
type Member = { user_id:string; display_name:string };

export default async function Empresa() {
  const { supabase, active } = await getContext();
  if (!active || active.context_type !== "business") redirect("/dashboard");
  const [{ data: receivables }, { data: payables }, { data: clients }, { data: contracts }, { data: goals }, { data: directory }] = await Promise.all([
    supabase.from("business_receivables").select("id,revenue_type,description,amount,due_date,status,client_id").eq("profile_id", active.id).order("due_date"),
    supabase.from("business_partner_payables").select("id,amount,status,user_id").eq("profile_id", active.id),
    supabase.from("business_clients").select("id,name").eq("profile_id", active.id).eq("active", true),
    supabase.from("business_contracts").select("id,revenue_type,monthly_amount,status,start_date,end_date").eq("profile_id", active.id).eq("status", "active"),
    supabase.from("goals").select("current_amount").eq("profile_id", active.id).neq("status", "concluida"),
    supabase.rpc("fn_profile_member_directory", { p_profile_id: active.id }),
  ]);
  const rows=(receivables ?? []) as Receivable[]; const obligations=(payables ?? []) as Payable[];
  const names=new Map((clients ?? []).map((c)=>[c.id,c.name])); const memberNames=new Map(((directory ?? []) as Member[]).map((m)=>[m.user_id,m.display_name]));
  const paid=(type:string)=>rows.filter(r=>r.status==="paid"&&r.revenue_type===type).reduce((s,r)=>s+Number(r.amount),0);
  const pending=rows.filter(r=>r.status==="pending"||r.status==="overdue");
  const today = new Date().toISOString().slice(0, 10);
  const mrr=(contracts ?? []).filter(c=>c.revenue_type==="recurring"&&(!c.start_date||c.start_date<=today)&&(!c.end_date||c.end_date>=today)).reduce((s,c)=>s+Number(c.monthly_amount??0),0);
  const partnerPending=obligations.filter(p=>p.status==="pending").reduce((s,p)=>s+Number(p.amount),0);
  const reserves=(goals ?? []).reduce((s,g)=>s+Number(g.current_amount),0);
  return <div className="flex flex-col gap-4">
    <div><p className="text-xs text-muted">Espaço empresarial</p><h1 className="text-xl font-bold">{active.name}</h1></div>
    <EmpresaTabs active="overview" />
    <section className="grid grid-cols-2 gap-3" aria-label="Indicadores da empresa">
      <Metric label="Implementações recebidas" value={brl(paid("implementation"))} tone="success" />
      <Metric label="Recorrência recebida" value={brl(paid("recurring"))} tone="success" />
      <Metric label="Receita recorrente mensal" value={brl(mrr)} />
      <Metric label="A receber" value={brl(pending.reduce((s,r)=>s+Number(r.amount),0))} tone="warning" />
      <Metric label="Repasses pendentes" value={brl(partnerPending)} tone="warning" />
      <Metric label="Reservas / caixinhas" value={brl(reserves)} />
    </section>
    <section className="card">
      <div className="flex justify-between gap-3"><div><p className="font-semibold">Próximos recebimentos</p><p className="text-xs text-muted">Por competência, sem confundir com transferências entre contas.</p></div><Link href="/empresa/clientes" className="text-brand text-sm font-bold">Gerenciar</Link></div>
      <div className="flex flex-col gap-2 mt-3">{pending.slice(0,5).map(r=><div key={r.id} className="surface-muted rounded-xl p-3 flex justify-between gap-3"><div><p className="text-sm font-semibold">{names.get(r.client_id) ?? r.description}</p><p className="text-xs text-muted">{r.revenue_type==="implementation"?"Implementação":"Recorrência"} · vence {new Date(`${r.due_date}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><strong className={r.status==="overdue"?"text-danger":""}>{brl(r.amount)}</strong></div>)}{pending.length===0&&<p className="text-sm text-muted">Nenhuma conta a receber pendente.</p>}</div>
    </section>
    <section className="card"><p className="font-semibold">Repasses aos sócios</p><div className="flex flex-col gap-2 mt-3">{obligations.filter(p=>p.status==="pending").slice(0,4).map(p=><div key={p.id} className="flex justify-between text-sm"><span>{memberNames.get(p.user_id)??"Sócio"}</span><strong>{brl(p.amount)}</strong></div>)}{partnerPending===0&&<p className="text-sm text-muted">Nenhum repasse pendente.</p>}</div><Link href="/empresa/socios" className="btn-secondary block mt-3">Regras e repasses</Link></section>
    <section className="status-warning"><strong>Fluxo correto:</strong> cliente paga na Infinity Pay → o valor é conciliado com a conta a receber → a transferência para o Nubank é movimento interno, não uma nova receita.</section>
  </div>;
}
function Metric({label,value,tone}:{label:string;value:string;tone?:"success"|"warning"}) { return <article className="card"><p className="label">{label}</p><p className={`text-lg font-bold ${tone==="success"?"text-success":tone==="warning"?"text-warning":""}`}>{value}</p></article> }
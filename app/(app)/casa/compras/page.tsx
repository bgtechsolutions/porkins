import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { brl } from "@/lib/format";
import { addHouseProduct, deleteHouseProduct, markProductBought } from "../../actions";
import CasaTabs from "../CasaTabs";

export const dynamic = "force-dynamic";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_NUM = Object.fromEntries(MONTHS.map((month, index) => [month, index + 1])) as Record<string, number>;

type Product = {
  id: string;
  name: string;
  category: string | null;
  priority: number | null;
  ideal_qty: string | null;
  planned_month: string | null;
  buy_when: string | null;
  budget_base: number | null;
  real_value: number | null;
  status: string;
  paid_by: string | null;
};
type SharedPurchase = {
  id: string;
  description: string | null;
  amount: number;
  occurred_at: string;
  installment_number: number;
  installment_count: number;
};
type View = "pendentes" | "temos" | "atribuidas";

export default async function ProdutosDaCasa({ searchParams }: { searchParams: Promise<{ visao?: string }> }) {
  const { supabase, profiles } = await getContext();
  const casa = profiles.find((profile) => profile.type === "compartilhado");
  if (!casa) return <p className="text-muted">Perfil Casa não encontrado.</p>;

  const params = await searchParams;
  const view: View = params.visao === "temos" || params.visao === "atribuidas" ? params.visao : "pendentes";
  const [{ data }, { data: sharedTransactions }] = await Promise.all([
    supabase.from("house_products").select("*").eq("profile_id", casa.id)
      .order("priority", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase.from("transactions")
      .select("id,description,amount,occurred_at,installment_number,installment_count")
      .eq("destination_profile_id", casa.id)
      .eq("transaction_type", "expense")
      .order("occurred_at", { ascending: false }),
  ]);

  const all = (data ?? []) as Product[];
  const owned = all.filter((product) => product.status === "comprado" || product.status === "presente");
  const pending = all.filter((product) => product.status !== "comprado" && product.status !== "presente");
  const purchases = (sharedTransactions ?? []) as SharedPurchase[];
  const budgetTotal = pending.reduce((sum, product) => sum + Number(product.budget_base ?? 0), 0);
  const boughtTotal = owned.reduce((sum, product) => sum + Number(product.real_value ?? 0), 0);
  const sharedTotal = purchases.reduce((sum, purchase) => sum + Number(purchase.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <CasaTabs active="compras" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Lista de produtos</h2>
          <p className="text-sm text-muted mt-1">A lista da planilha, organizada para consultar e atualizar.</p>
        </div>
        <details className="inline-disclosure">
          <summary className="quiet-action">Adicionar</summary>
          <div className="card floating-form">
            <h3 className="font-semibold">Novo produto</h3>
            <form action={addHouseProduct} className="flex flex-col gap-2 mt-3">
              <input type="hidden" name="profile_id" value={casa.id} />
              <input name="name" required className="input" placeholder="Nome do produto" aria-label="Nome do produto" />
              <div className="grid grid-cols-2 gap-2">
                <input name="category" className="input" placeholder="Categoria" aria-label="Categoria do produto" />
                <input name="ideal_qty" className="input" placeholder="Quantidade" aria-label="Quantidade ideal" />
                <select name="planned_month" defaultValue="" className="input" aria-label="Mês planejado">
                  <option value="">Sem mês definido</option>
                  {MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
                </select>
                <input name="priority" type="number" min="1" className="input" placeholder="Prioridade" aria-label="Prioridade da compra" />
                <input name="budget_base" inputMode="decimal" className="input col-span-2" placeholder="Valor previsto" aria-label="Valor previsto" />
              </div>
              <button className="btn">Salvar produto</button>
            </form>
          </div>
        </details>
      </div>

      <dl className="compact-metrics" aria-label="Resumo da lista da casa">
        <Metric label="A comprar" value={String(pending.length)} />
        <Metric label="Já temos" value={String(owned.length)} />
        <Metric label="Previsto" value={brl(budgetTotal)} />
      </dl>

      <nav className="view-switcher" aria-label="Visualização dos produtos">
        <ViewLink view="pendentes" current={view} label="A comprar" count={pending.length} />
        <ViewLink view="temos" current={view} label="Já temos" count={owned.length} />
        <ViewLink view="atribuidas" current={view} label="Atribuídas" count={purchases.length} />
      </nav>

      {view === "pendentes" && (
        <section aria-labelledby="pending-products">
          <div className="list-heading">
            <div><h2 id="pending-products" className="section-title">A comprar</h2><p className="text-xs text-muted">Abra um item apenas quando quiser registrar a compra.</p></div>
            <strong className="text-sm">{brl(budgetTotal)}</strong>
          </div>
          <div className="compact-list mt-2">
            {pending.map((product) => <ProductRow key={product.id} product={product} />)}
            {pending.length === 0 && <EmptyState title="A lista está em dia" detail="Não há produtos pendentes." />}
          </div>
        </section>
      )}

      {view === "temos" && (
        <section aria-labelledby="owned-products">
          <div className="list-heading">
            <div><h2 id="owned-products" className="section-title">Já temos</h2><p className="text-xs text-muted">Comprados e presentes registrados.</p></div>
            <strong className="text-sm">{brl(boughtTotal)}</strong>
          </div>
          <div className="compact-list mt-2">
            {owned.map((product) => <ProductRow key={product.id} product={product} owned />)}
            {owned.length === 0 && <EmptyState title="Nenhum produto registrado" detail="Quando uma compra for confirmada, ela aparecerá aqui." />}
          </div>
        </section>
      )}

      {view === "atribuidas" && (
        <section aria-labelledby="assigned-purchases">
          <div className="list-heading">
            <div><h2 id="assigned-purchases" className="section-title">Compras atribuídas à Casa</h2><p className="text-xs text-muted">Pagas nas contas pessoais dos membros.</p></div>
            <strong className="text-sm">{brl(sharedTotal)}</strong>
          </div>
          <div className="compact-list mt-2">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="compact-row">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{purchase.description ?? "Compra compartilhada"}</p>
                  <p className="text-xs text-muted">{formatDate(purchase.occurred_at)}{purchase.installment_count > 1 ? " · " + purchase.installment_number + "/" + purchase.installment_count : ""}</p>
                </div>
                <strong className="text-sm whitespace-nowrap">{brl(purchase.amount)}</strong>
              </div>
            ))}
            {purchases.length === 0 && <EmptyState title="Nenhuma compra atribuída" detail="Ao destinar uma compra pessoal à Casa, ela aparecerá aqui." />}
          </div>
          <Link href="/acertos" className="btn-secondary mt-3">Ver divisão e acertos</Link>
        </section>
      )}
    </div>
  );
}

function ViewLink({ view, current, label, count }: { view: View; current: View; label: string; count: number }) {
  return <Link href={"/casa/compras?visao=" + view} className={"view-chip " + (current === view ? "view-chip-active" : "")} aria-current={current === view ? "page" : undefined}>{label}<span>{count}</span></Link>;
}

function ProductRow({ product, owned = false }: { product: Product; owned?: boolean }) {
  const currentMonth = new Date().getMonth() + 1;
  const overdue = !owned && product.planned_month && MONTH_NUM[product.planned_month] && MONTH_NUM[product.planned_month] < currentMonth;
  const status = product.status === "presente" ? "Presente" : owned ? brl(product.real_value) : product.budget_base ? brl(product.budget_base) : "Sem valor";
  return (
    <details className="product-row">
      <summary>
        <span className="min-w-0">
          <strong className="block text-sm truncate">{product.name}</strong>
          <span className="text-xs text-muted">{product.category ?? "Sem categoria"}{product.ideal_qty ? " · " + product.ideal_qty : ""}</span>
        </span>
        <span className="text-right whitespace-nowrap">
          <strong className="block text-sm">{status}</strong>
          <span className={overdue ? "text-xs text-warning" : "text-xs text-muted"}>{overdue ? "Replanejar" : product.planned_month ?? (owned ? "Registrado" : "Sem data")}</span>
        </span>
      </summary>
      <div className="product-details">
        <dl className="product-meta">
          <div><dt>Quando</dt><dd>{product.buy_when ?? product.planned_month ?? "Não definido"}</dd></div>
          <div><dt>Prioridade</dt><dd>{product.priority ?? "Não definida"}</dd></div>
          {owned && <div><dt>Pago por</dt><dd>{product.paid_by ?? "Não informado"}</dd></div>}
        </dl>
        {!owned && (
          <form action={markProductBought} className="flex gap-2 mt-3">
            <input type="hidden" name="product_id" value={product.id} />
            <input name="real_value" className="input" placeholder="Quanto pagou" inputMode="decimal" aria-label={"Valor pago por " + product.name} />
            <button className="btn whitespace-nowrap">Marcar comprado</button>
          </form>
        )}
        <form action={deleteHouseProduct} className="mt-2">
          <input type="hidden" name="id" value={product.id} />
          <button className="text-danger text-sm min-h-11" aria-label={"Excluir produto " + product.name}>Excluir da lista</button>
        </form>
      </div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-calm"><span className="status-dot status-dot-good" aria-hidden="true" /><div><strong className="text-sm">{title}</strong><p className="text-xs text-muted">{detail}</p></div></div>;
}

function formatDate(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("pt-BR");
}

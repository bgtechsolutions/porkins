import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { importTransactionsCsv } from "../actions";

export const dynamic = "force-dynamic";

export default async function Importar() {
  const { active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">Importar CSV — {active.name}</h2>
        <p className="text-sm text-muted">Até 500 lançamentos ou 1 MB por arquivo.</p>
      </div>
      <form action={importTransactionsCsv} className="card flex flex-col gap-4">
        <input type="hidden" name="profile_id" value={active.id} />
        <div>
          <label htmlFor="file" className="label">Arquivo CSV</label>
          <input id="file" name="file" type="file" accept=".csv,text/csv" required className="input" />
        </div>
        <div className="text-xs text-muted leading-relaxed">
          <p className="font-semibold text-foreground">Colunas obrigatórias: Data e Valor.</p>
          <p>Opcionais: Descrição, Categoria e Conta. Aceita vírgula ou ponto e vírgula e datas DD/MM/AAAA ou AAAA-MM-DD.</p>
          <p>Categorias e contas desconhecidas ficam vazias para revisão, sem criar cadastros automaticamente.</p>
        </div>
        <button className="btn">Importar lançamentos</button>
      </form>
      <Link href="/extrato" className="text-sm text-brand font-semibold">← Voltar ao extrato</Link>
    </div>
  );
}

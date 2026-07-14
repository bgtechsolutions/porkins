import { login, loginWithGoogle } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🐷</div>
          <h1 className="text-2xl font-bold">Porkin</h1>
          <p className="text-muted text-sm mt-1">Controle financeiro do Gabriel, da Bárbara e da Casa</p>
        </div>

        <div className="card flex flex-col gap-4">
          <form action={loginWithGoogle}>
            <button type="submit" className="btn w-full">Continuar com Google</button>
          </form>
          <p className="text-xs text-muted text-center">
            O acesso ao Gmail é somente leitura e serve para lançar automaticamente as notificações do Nubank.
          </p>
          <details>
            <summary className="text-sm text-muted cursor-pointer">Primeiro acesso: vincular a conta atual</summary>
            <form action={login} className="flex flex-col gap-4 mt-4">
              <div>
                <label className="label" htmlFor="email">E-mail atual do Porkin</label>
                <input id="email" name="email" type="email" required className="input" autoComplete="email" />
              </div>
              <div>
                <label className="label" htmlFor="password">Senha atual</label>
                <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
              </div>
              <button type="submit" className="btn">Entrar uma última vez com senha</button>
            </form>
          </details>
          {erro && <p className="text-sm text-red-500 font-medium">{erro}</p>}
        </div>
      </div>
    </main>
  );
}

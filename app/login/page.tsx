import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🐷</div>
          <h1 className="text-2xl font-bold">Porkin</h1>
          <p className="text-muted text-sm mt-1">
            Controle financeiro do Gabriel, da Bárbara e da Casa
          </p>
        </div>

        <form action={login} className="card flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input"
              placeholder="voce@porkin.app"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input"
              autoComplete="current-password"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-500 font-medium">{erro}</p>
          )}

          <button type="submit" className="btn">
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

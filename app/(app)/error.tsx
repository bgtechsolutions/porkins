"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card flex flex-col gap-3" role="alert">
      <h2 className="font-bold">Não foi possível concluir esta ação.</h2>
      <p className="text-sm text-muted">Seus dados anteriores continuam seguros. Tente novamente; se o erro persistir, verifique a conexão.</p>
      <button type="button" className="btn" onClick={reset}>Tentar novamente</button>
    </div>
  );
}

// ============================================================
// Módulo 1 - Acesso negado
// Mostrada quando o usuário está logado, mas não tem a permissão
// exigida pela página que tentou abrir.
// ============================================================

import Link from "next/link";

export default function AcessoNegadoPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Acesso negado</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Você não tem permissão para acessar esta página. Se precisar do
          acesso, peça a um administrador para conceder a permissão em
          Módulos e Permissões.
        </p>
        <Link
          href="/produtos"
          className="mt-5 inline-flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
        >
          Voltar aos produtos
        </Link>
      </div>
    </main>
  );
}

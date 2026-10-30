// ============================================================
// Módulo 1 - Login: tela de entrada
// Quem já está logado não precisa ver o formulário: vai direto
// para a lista de produtos.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { redirect } from "next/navigation";

import { usuarioAtual } from "@/lib/autorizacao";

import FormularioLogin from "./FormularioLogin";

// Precisa checar a sessão a cada acesso, sem cache
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const usuario = await usuarioAtual();
  if (usuario) redirect("/produtos");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Entrar</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Acesse com o seu e-mail e a sua senha.
        </p>

        <div className="mt-5">
          <FormularioLogin />
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Módulo 1 - Login: tela de entrada
// Quem já está logado não precisa ver o formulário: vai direto
// para o Dashboard.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { redirect } from "next/navigation";

import { usuarioAtual } from "@/lib/autorizacao";

import BotaoGoogle from "./BotaoGoogle";
import FormularioLogin from "./FormularioLogin";

const MENSAGENS_GOOGLE: Record<string, string> = {
  cancelado: "O login com Google foi cancelado.",
  falha: "Não foi possível concluir o login com Google. Tente novamente.",
  "nao-autorizado":
    "Use uma conta Google com e-mail verificado cadastrado e ativo no Átria.",
  configuracao:
    "O login com Google ainda não está configurado. Consulte as instruções de configuração.",
};

// Precisa checar a sessão a cada acesso, sem cache
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const usuario = await usuarioAtual();
  if (usuario) redirect("/dashboard");

  const parametros = await searchParams;
  const resultadoGoogle = Array.isArray(parametros.google)
    ? parametros.google[0]
    : parametros.google;
  const mensagemGoogle = resultadoGoogle
    ? MENSAGENS_GOOGLE[resultadoGoogle]
    : undefined;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Entrar</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Acesse com sua conta Google cadastrada ou com e-mail e senha.
        </p>

        {mensagemGoogle && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {mensagemGoogle}
          </p>
        )}

        <div className="mt-5">
          <FormularioLogin />
        </div>

        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-zinc-200" />
          <span className="text-sm text-zinc-500">ou</span>
          <span className="h-px flex-1 bg-zinc-200" />
        </div>

        <BotaoGoogle />

        <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
          O e-mail da conta Google precisa pertencer a um usuário já cadastrado
          e ativo no Átria.
        </p>
      </div>
    </main>
  );
}

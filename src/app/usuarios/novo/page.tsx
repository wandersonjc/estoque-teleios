// ============================================================
// Módulo 1 - Usuários: tela de cadastro
// Só entra quem tem a permissão de cadastrar usuários.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import Link from "next/link";

import UsuarioForm from "../UsuarioForm";
import { criarUsuario } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovoUsuarioPage() {
  await exigirPermissao("usuarios.usuario.criar");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Novo usuário</h1>
        <Link href="/usuarios" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      <div className="mt-4">
        <UsuarioForm acao={criarUsuario} textoBotao="Cadastrar usuário" />
      </div>
    </main>
  );
}

// ============================================================
// Módulo 1 - Usuários: tela de cadastro
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import Link from "next/link";

import UsuarioForm from "../UsuarioForm";
import { criarUsuario } from "../actions";

export default function NovoUsuarioPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Novo usuário</h1>
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

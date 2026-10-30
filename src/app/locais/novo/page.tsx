// ============================================================
// Módulo 1 - Locais de estoque: tela de cadastro
// ============================================================

import Link from "next/link";

import LocalForm from "../LocalForm";
import { criarLocal } from "../actions";

export default function NovoLocalPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Novo local</h1>
        <Link href="/locais" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      <div className="mt-4">
        <LocalForm acao={criarLocal} textoBotao="Cadastrar local" />
      </div>
    </main>
  );
}

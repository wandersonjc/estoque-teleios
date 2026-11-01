import { exigirPermissao } from "@/lib/autorizacao";
import Link from "next/link";

import CargoForm from "../CargoForm";
import { criarCargo } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovoCargoPage() {
  await exigirPermissao("cargos.cargo.criar");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Novo cargo</h1>
        <Link href="/cargos" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>
      <div className="mt-4">
        <CargoForm acao={criarCargo} textoBotao="Cadastrar cargo" />
      </div>
    </main>
  );
}
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CargoForm from "../CargoForm";
import { atualizarCargo } from "../actions";
import { cargoProtegido } from "../tipos";

export const dynamic = "force-dynamic";

function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function EditarCargoPage({
  params,
  searchParams,
}: PageProps<"/cargos/[id]">) {
  await exigirPermissao("cargos.cargo.editar");

  const { id } = await params;
  const parametros = await searchParams;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const cargo = await prisma.cargo.findUnique({ where: { id: numero } });
  if (!cargo) notFound();
  if (cargoProtegido(cargo.nome)) redirect("/cargos?erro=protegido");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-lg font-normal text-zinc-900 sm:text-xl">
          <strong className="font-semibold">Editar cargo</strong>
          {" | "}
          {cargo.nome}
        </h1>
        <Link href="/cargos" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {textoDoParametro(parametros.salvo) === "1" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800">
          Cargo salvo com sucesso.
        </p>
      )}

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
        <CargoForm
          acao={atualizarCargo}
          textoBotao="Salvar alterações"
          id={cargo.id}
          valoresIniciais={{ nome: cargo.nome }}
        />
      </div>
    </main>
  );
}
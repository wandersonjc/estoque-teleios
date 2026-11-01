import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

import FuncaoForm from "../FuncaoForm";
import { atualizarFuncao } from "../actions";

export const dynamic = "force-dynamic";

function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function EditarFuncaoPage({
  params,
  searchParams,
}: PageProps<"/funcoes/[id]">) {
  await exigirPermissao("funcoes.funcao.editar");

  const { id } = await params;
  const parametros = await searchParams;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const funcao = await prisma.funcao.findUnique({ where: { id: numero } });
  if (!funcao) notFound();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-lg font-normal text-zinc-900 sm:text-xl">
          <strong className="font-semibold">Editar função</strong>
          {" | "}
          {funcao.nome}
        </h1>
        <Link href="/funcoes" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {textoDoParametro(parametros.salvo) === "1" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800">
          Função salva com sucesso.
        </p>
      )}

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
        <FuncaoForm
          acao={atualizarFuncao}
          textoBotao="Salvar alterações"
          id={funcao.id}
          valoresIniciais={{ nome: funcao.nome }}
        />
      </div>
    </main>
  );
}

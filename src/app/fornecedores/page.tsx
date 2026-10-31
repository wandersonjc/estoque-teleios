// ============================================================
// Módulo 2 - Lista de fornecedores
// Cadastro (prazo, pedido mínimo e frete) — item 1 do Módulo 2.
// ============================================================

import BotaoAcao from "@/components/BotaoAcao";
import { IconeCheck, IconeLapis } from "@/components/icones";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import type { FornecedorWhereInput } from "@/generated/prisma/models";
import Image from "next/image";
import Link from "next/link";

import { desativarFornecedor, reativarFornecedor } from "./actions";
import { formatarMoedaOpcional } from "./tipos";

export const dynamic = "force-dynamic";

function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function PaginaFornecedores({
  searchParams,
}: PageProps<"/fornecedores">) {
  const atual = await exigirPermissao("fornecedores.fornecedor.consultar");

  const parametros = await searchParams;
  const busca = textoDoParametro(parametros.busca).trim();
  const mostrarInativos = textoDoParametro(parametros.inativos) === "1";

  const filtro: FornecedorWhereInput = {};
  if (!mostrarInativos) filtro.ativo = true;
  if (busca !== "") {
    filtro.nome = { contains: busca, mode: "insensitive" };
  }

  const fornecedores = await prisma.fornecedor.findMany({
    where: filtro,
    orderBy: { nome: "asc" },
    include: {
      _count: { select: { produtos: true } },
    },
  });

  const podeCriar = atual.permissoes.has("fornecedores.fornecedor.criar");
  const podeEditar = atual.permissoes.has("fornecedores.fornecedor.editar");
  const podeDesativar = atual.permissoes.has(
    "fornecedores.fornecedor.desativar"
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Fornecedores</h1>
        {podeCriar && (
          <Link
            href="/fornecedores/novo"
            className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
          >
            Novo fornecedor
          </Link>
        )}
      </div>

      <form
        action="/fornecedores"
        method="get"
        className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="busca" className="text-base font-medium text-zinc-800">
            Buscar
          </label>
          <input
            id="busca"
            name="busca"
            type="search"
            defaultValue={busca}
            placeholder="Nome do fornecedor"
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex items-center gap-2 text-base text-zinc-800">
            <input
              type="checkbox"
              name="inativos"
              value="1"
              defaultChecked={mostrarInativos}
              className="h-5 w-5"
            />
            Mostrar inativos
          </label>
          <button
            type="submit"
            className="h-12 rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
          >
            Buscar
          </button>
        </div>
      </form>

      <p className="mt-4 text-sm text-zinc-600" role="status">
        {fornecedores.length === 0
          ? "Nenhum fornecedor encontrado."
          : `${fornecedores.length} fornecedor(es).`}
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {fornecedores.map((fornecedor) => (
          <li
            key={fornecedor.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-xl font-semibold text-zinc-500">
                  {fornecedor.imagemChave ? (
                    <Image
                      src={`/api/imagens/fornecedores/${fornecedor.id}`}
                      alt={fornecedor.nome}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    fornecedor.nome.slice(0, 1).toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-[#002855] sm:text-lg">
                    {fornecedor.nome}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {fornecedor.contato || "Sem contato registrado"}
                  </p>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                  <div>
                    <span className="font-medium uppercase tracking-wider text-zinc-400">
                      Prazo
                    </span>
                    <p className="font-bold text-[#002855]">
                      {fornecedor.prazoEntregaDias !== null
                        ? `${fornecedor.prazoEntregaDias} dias`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium uppercase tracking-wider text-zinc-400">
                      Pedido mínimo
                    </span>
                    <p className="font-bold text-[#002855]">
                      {formatarMoedaOpcional(fornecedor.valorMinimoPedido)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium uppercase tracking-wider text-zinc-400">
                      Frete
                    </span>
                    <p className="font-bold text-[#002855]">
                      {formatarMoedaOpcional(fornecedor.frete)}
                    </p>
                  </div>
                </div>

                  <p className="mt-3 text-sm text-zinc-600">
                    {fornecedor._count.produtos} produto(s) vinculado(s)
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {podeDesativar ? (
                  <form
                    action={
                      fornecedor.ativo ? desativarFornecedor : reativarFornecedor
                    }
                  >
                    <input type="hidden" name="id" value={fornecedor.id} />
                    <BotaoAcao
                      title={fornecedor.ativo ? "Desativar" : "Reativar"}
                      className="transition-opacity hover:opacity-80"
                    >
                      <div
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ${
                          fornecedor.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                        }`}
                      >
                        {fornecedor.ativo && (
                          <IconeCheck className="h-3.5 w-3.5" />
                        )}
                        {fornecedor.ativo ? "Ativo" : "Inativo"}
                      </div>
                    </BotaoAcao>
                  </form>
                ) : (
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ${
                      fornecedor.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                    }`}
                  >
                    {fornecedor.ativo && <IconeCheck className="h-3.5 w-3.5" />}
                    {fornecedor.ativo ? "Ativo" : "Inativo"}
                  </div>
                )}

                <Link
                  href={`/fornecedores/${fornecedor.id}`}
                  aria-label={
                    podeEditar
                      ? `Editar ${fornecedor.nome}`
                      : `Ver ${fornecedor.nome}`
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-[#002855] shadow-sm"
                >
                  <IconeLapis className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

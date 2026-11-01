import type {
  CargoOrderByWithRelationInput,
  CargoWhereInput,
} from "@/generated/prisma/models";
import BotaoAcao from "@/components/BotaoAcao";
import LinkAcaoComCarregamento from "@/components/LinkAcaoComCarregamento";
import { IconeEditar, IconeExcluir } from "@/components/icones";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";

import { excluirCargo } from "./actions";
import {
  TAMANHOS_PAGINA_CARGOS,
  TAMANHO_PAGINA_CARGOS_PADRAO,
} from "./tipos";

export const dynamic = "force-dynamic";

type ColunaOrdenacao = "nome" | "usuarios";
type DirecaoOrdenacao = "asc" | "desc";

function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function CargosPage({
  searchParams,
}: PageProps<"/cargos">) {
  await exigirPermissao("cargos.cargo.consultar");

  const parametros = await searchParams;
  const busca = textoDoParametro(parametros.busca).trim();
  const ordenacao: ColunaOrdenacao =
    textoDoParametro(parametros.ordenacao) === "usuarios" ? "usuarios" : "nome";
  const direcao: DirecaoOrdenacao =
    textoDoParametro(parametros.direcao) === "desc" ? "desc" : "asc";
  const tamanhoPedido = Number(textoDoParametro(parametros.tamanho));
  const tamanho = (
    TAMANHOS_PAGINA_CARGOS as readonly number[]
  ).includes(tamanhoPedido)
    ? tamanhoPedido
    : TAMANHO_PAGINA_CARGOS_PADRAO;
  const paginaPedido = Number(textoDoParametro(parametros.pagina));
  const paginaInicial =
    Number.isInteger(paginaPedido) && paginaPedido > 0 ? paginaPedido : 1;

  const filtro: CargoWhereInput = busca
    ? { nome: { contains: busca, mode: "insensitive" } }
    : {};
  const total = await prisma.cargo.count({ where: filtro });
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);
  const orderBy: CargoOrderByWithRelationInput[] =
    ordenacao === "usuarios"
      ? [{ usuarios: { _count: direcao } }, { nome: "asc" }, { id: "asc" }]
      : [{ nome: direcao }, { id: "asc" }];
  const cargos = await prisma.cargo.findMany({
    where: filtro,
    orderBy,
    skip: (pagina - 1) * tamanho,
    take: tamanho,
    include: { _count: { select: { usuarios: true } } },
  });

  function urlDaLista(extras: Record<string, string> = {}): string {
    const parametrosUrl = new URLSearchParams();
    if (busca !== "") parametrosUrl.set("busca", busca);
    if (tamanho !== TAMANHO_PAGINA_CARGOS_PADRAO) {
      parametrosUrl.set("tamanho", String(tamanho));
    }
    if (ordenacao !== "nome") parametrosUrl.set("ordenacao", ordenacao);
    if (direcao !== "asc") parametrosUrl.set("direcao", direcao);
    for (const [chave, valor] of Object.entries(extras)) {
      parametrosUrl.set(chave, valor);
    }
    return `/cargos?${parametrosUrl.toString()}`;
  }

  function urlDaOrdenacao(coluna: ColunaOrdenacao): string {
    const proximaDirecao: DirecaoOrdenacao =
      coluna === ordenacao && direcao === "asc" ? "desc" : "asc";
    return urlDaLista({ ordenacao: coluna, direcao: proximaDirecao, pagina: "1" });
  }

  function urlDaPagina(numero: number): string {
    return urlDaLista({ pagina: String(numero) });
  }

  const erro = textoDoParametro(parametros.erro);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Cargos</h1>
        <Link
          href="/cargos/novo"
          className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
        >
          Novo cargo
        </Link>
      </div>

      {erro === "em-uso" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700">
          Não é possível excluir um cargo associado a usuários.
        </p>
      )}

      <form
        action="/cargos"
        method="get"
        className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3"
      >
        <input type="hidden" name="ordenacao" value={ordenacao} />
        <input type="hidden" name="direcao" value={direcao} />
        <div className="flex flex-col gap-1">
          <label htmlFor="busca-cargo" className="text-base font-medium text-zinc-800">
            Buscar cargo
          </label>
          <input
            id="busca-cargo"
            name="busca"
            type="search"
            defaultValue={busca}
            placeholder="Nome do cargo"
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex items-center gap-2 text-base text-zinc-800">
            Cargos por página
            <select
              name="tamanho"
              defaultValue={String(tamanho)}
              className="h-11 rounded-lg border border-zinc-300 bg-white px-2 text-base text-zinc-900"
            >
              {TAMANHOS_PAGINA_CARGOS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
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
        {total === 0
          ? "Nenhum cargo encontrado."
          : `${total} cargo(s) — página ${pagina} de ${totalPaginas}`}
      </p>

      {cargos.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-180 border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr className="border-b border-zinc-200">
                {(
                  [
                    ["nome", "Cargo"],
                    ["usuarios", "Usuários vinculados"],
                  ] as const
                ).map(([coluna, rotulo]) => (
                  <th
                    key={coluna}
                    scope="col"
                    aria-sort={
                      ordenacao === coluna
                        ? direcao === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="whitespace-nowrap px-3 py-3 font-semibold"
                  >
                    <Link
                      href={urlDaOrdenacao(coluna)}
                      className="inline-flex items-center gap-2 hover:text-zinc-900"
                    >
                      {rotulo}
                      <span aria-hidden="true" className="text-xs">
                        {ordenacao === coluna
                          ? direcao === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </Link>
                  </th>
                ))}
                <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((cargo) => {
                const associado = cargo._count.usuarios > 0;
                return (
                  <tr
                    key={cargo.id}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {cargo.nome}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                      {cargo._count.usuarios}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex items-center gap-2">
                        <LinkAcaoComCarregamento
                          href={`/cargos/${cargo.id}`}
                          title="Editar cargo"
                          ariaLabel={`Editar cargo ${cargo.nome}`}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                          tamanhoIconeCarregando="h-4 w-4"
                        >
                          <IconeEditar className="h-4 w-4" />
                        </LinkAcaoComCarregamento>
                        <form action={excluirCargo}>
                          <input type="hidden" name="id" value={cargo.id} />
                          <BotaoAcao
                            title={
                              associado
                                ? "Cargo associado a usuários"
                                : "Excluir cargo"
                            }
                            ariaLabel={
                              associado
                                ? `Cargo ${cargo.nome} não pode ser excluído porque está associado a usuários`
                                : `Excluir cargo ${cargo.nome}`
                            }
                            disabled={associado}
                            confirmacao={`Excluir o cargo "${cargo.nome}"? Esta ação não pode ser desfeita.`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-white"
                          >
                            <IconeExcluir className="h-4 w-4" />
                          </BotaoAcao>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <nav
          aria-label="Paginação de cargos"
          className="mt-4 flex items-center justify-between gap-3"
        >
          {pagina > 1 ? (
            <Link
              href={urlDaPagina(pagina - 1)}
              rel="prev"
              className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Anterior
            </Link>
          ) : (
            <span className="flex h-11 items-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-400">
              Anterior
            </span>
          )}
          <span className="text-sm text-zinc-600">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link
              href={urlDaPagina(pagina + 1)}
              rel="next"
              className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Próxima
            </Link>
          ) : (
            <span className="flex h-11 items-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-400">
              Próxima
            </span>
          )}
        </nav>
      )}
    </main>
  );
}
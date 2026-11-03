import Link from "next/link";

import LinkAcaoComCarregamento from "@/components/LinkAcaoComCarregamento";
import { IconeDocumento } from "@/components/icones";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import type {
  PedidoCompraOrderByWithRelationInput,
  PedidoCompraWhereInput,
} from "@/generated/prisma/models";
import { formatarDataBr } from "@/app/produtos/tipos";

import BuscaFiltrosPedidos from "./BuscaFiltrosPedidos";

export const dynamic = "force-dynamic";

const TAMANHOS = [10, 25, 50, 75, 100] as const;
const COLUNAS = ["id", "fornecedor", "status", "criadoEm", "previsaoEntrega"] as const;
const STATUS = ["RASCUNHO", "ENVIADO", "RECEBIDO", "CANCELADO"] as const;
type Coluna = (typeof COLUNAS)[number];
type StatusPedido = (typeof STATUS)[number];
type Direcao = "asc" | "desc";

function parametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function rotuloStatus(status: StatusPedido): string {
  switch (status) {
    case "RASCUNHO":
      return "Rascunho — aguardando envio";
    case "ENVIADO":
      return "Enviado";
    case "RECEBIDO":
      return "Recebido";
    case "CANCELADO":
      return "Cancelado";
  }
}

function estiloStatus(status: StatusPedido): string {
  switch (status) {
    case "RASCUNHO":
      return "bg-amber-100 text-amber-900";
    case "ENVIADO":
      return "bg-blue-100 text-blue-800";
    case "RECEBIDO":
      return "bg-green-100 text-green-800";
    case "CANCELADO":
      return "bg-zinc-100 text-zinc-700";
  }
}

export default async function PedidosPage({
  searchParams,
}: PageProps<"/pedidos">) {
  const usuario = await exigirPermissao("pedidos.pedido.consultar");
  const podeMontar = usuario.permissoes.has("pedidos.rascunho.gerenciar");
  const parametros = await searchParams;
  const busca = parametro(parametros.busca).trim();
  const filtroStatus = STATUS.includes(parametro(parametros.status) as StatusPedido)
    ? (parametro(parametros.status) as StatusPedido)
    : "";
  const tamanhoInformado = Number(parametro(parametros.tamanho));
  const tamanho = (TAMANHOS as readonly number[]).includes(tamanhoInformado)
    ? tamanhoInformado
    : 10;
  const paginaInformada = Number(parametro(parametros.pagina));
  const paginaInicial =
    Number.isInteger(paginaInformada) && paginaInformada > 0
      ? paginaInformada
      : 1;
  const ordenacaoSolicitada = parametro(parametros.ordenacao);
  const ordenacao = COLUNAS.includes(ordenacaoSolicitada as Coluna)
    ? (ordenacaoSolicitada as Coluna)
    : "criadoEm";
  const direcao: Direcao = parametro(parametros.direcao) === "asc" ? "asc" : "desc";

  const where: PedidoCompraWhereInput = {};
  if (filtroStatus) where.status = filtroStatus;
  if (busca) {
    const numero = Number(busca.replace(/^#/, ""));
    where.OR = [
      ...(Number.isInteger(numero) && numero > 0 ? [{ id: numero }] : []),
      { fornecedor: { is: { nome: { contains: busca, mode: "insensitive" } } } },
      {
        itens: {
          some: {
            produto: { is: { nome: { contains: busca, mode: "insensitive" } } },
          },
        },
      },
    ];
  }

  const total = await prisma.pedidoCompra.count({ where });

  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);
  const orderBy: PedidoCompraOrderByWithRelationInput =
    ordenacao === "fornecedor"
      ? { fornecedor: { nome: direcao } }
      : { [ordenacao]: direcao };
  const pedidos = await prisma.pedidoCompra.findMany({
    where,
    orderBy: [orderBy, { id: "desc" }],
    skip: (pagina - 1) * tamanho,
    take: tamanho,
    include: {
      fornecedor: { select: { nome: true } },
      comprador: { select: { nome: true } },
      itens: { select: { id: true } },
    },
  });

  function urlDaLista(extras: Record<string, string>) {
    const query = new URLSearchParams();
    if (busca) query.set("busca", busca);
    if (filtroStatus) query.set("status", filtroStatus);
    if (tamanho !== 10) query.set("tamanho", String(tamanho));
    if (ordenacao !== "criadoEm") query.set("ordenacao", ordenacao);
    if (direcao !== "desc") query.set("direcao", direcao);
    for (const [chave, valor] of Object.entries(extras)) {
      query.set(chave, valor);
    }
    return `/pedidos?${query.toString()}`;
  }

  function urlOrdenacao(coluna: Coluna) {
    return urlDaLista({
      ordenacao: coluna,
      direcao:
        coluna === ordenacao && direcao === "asc" ? "desc" : "asc",
      pagina: "1",
    });
  }

  function cabecalho(coluna: Coluna, texto: string) {
    return (
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
          href={urlOrdenacao(coluna)}
          data-list-navigation="true"
          className="inline-flex items-center gap-2 hover:text-zinc-900"
        >
          {texto}
          <span aria-hidden="true">
            {ordenacao === coluna ? (direcao === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </Link>
      </th>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Pedidos de compra</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Rascunhos aguardam envio; não existe etapa separada de aprovação.
          </p>
        </div>
        {podeMontar && (
          <Link
            href="/pedidos/comparar"
            className="flex h-12 items-center justify-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
          >
            Comparar reposição
          </Link>
        )}
      </div>

      <BuscaFiltrosPedidos
        rota="/pedidos"
        busca={busca}
        nomeFiltro="status"
        rotuloFiltro="Status do pedido"
        filtro={filtroStatus}
        opcoesFiltro={[
          { valor: "", rotulo: "Todos os status" },
          { valor: "RASCUNHO", rotulo: "Rascunho — aguardando envio" },
          { valor: "ENVIADO", rotulo: "Enviado" },
          { valor: "RECEBIDO", rotulo: "Recebido" },
          { valor: "CANCELADO", rotulo: "Cancelado" },
        ]}
        tamanho={tamanho}
        ordenacao={ordenacao}
        direcao={direcao}
        resumo={
          <p role="status" className="mt-4 text-sm text-zinc-600">
            {total === 0
              ? "Nenhum pedido encontrado."
              : `${total} pedido(s) — página ${pagina} de ${totalPaginas}`}
          </p>
        }
      >
        {pedidos.length === 0 ? (
          <p className="mt-3 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
            Ainda não há pedidos para os filtros selecionados.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr className="border-b border-zinc-200">
                  {cabecalho("id", "Pedido")}
                  {cabecalho("fornecedor", "Fornecedor")}
                  {cabecalho("status", "Status")}
                  {cabecalho("criadoEm", "Criado em")}
                  {cabecalho("previsaoEntrega", "Previsão de entrega")}
                  <th scope="col" className="px-3 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id} className="border-b border-zinc-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-zinc-900">
                      #{pedido.id}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-zinc-900">{pedido.fornecedor.nome}</div>
                      <div className="text-xs text-zinc-500">
                        {pedido.itens.length} item(ns) · comprador: {pedido.comprador.nome}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${estiloStatus(pedido.status)}`}>
                        {rotuloStatus(pedido.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                      {formatarDataBr(pedido.dataCompra ?? pedido.criadoEm)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                      {pedido.previsaoEntrega
                        ? formatarDataBr(pedido.previsaoEntrega)
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <LinkAcaoComCarregamento
                        href={`/pedidos/${pedido.id}`}
                        title="Abrir pedido"
                        ariaLabel={`Abrir pedido ${pedido.id} de ${pedido.fornecedor.nome}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                        tamanhoIconeCarregando="h-4 w-4"
                      >
                        <IconeDocumento className="h-4 w-4" />
                      </LinkAcaoComCarregamento>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && (
          <nav aria-label="Paginação dos pedidos" className="mt-4 flex items-center justify-between gap-3">
            {pagina > 1 ? (
              <Link
                href={urlDaLista({ pagina: String(pagina - 1) })}
                data-list-navigation="true"
                className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium"
              >
                Anterior
              </Link>
            ) : <span />}
            <span className="text-sm text-zinc-600">{pagina} / {totalPaginas}</span>
            {pagina < totalPaginas ? (
              <Link
                href={urlDaLista({ pagina: String(pagina + 1) })}
                data-list-navigation="true"
                className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium"
              >
                Próxima
              </Link>
            ) : <span />}
          </nav>
        )}
      </BuscaFiltrosPedidos>
    </main>
  );
}

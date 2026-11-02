import BotaoAcao from "@/components/BotaoAcao";
import LinkAcaoComCarregamento from "@/components/LinkAcaoComCarregamento";
import {
  IconeDocumento,
  IconeEditar,
  IconeEntrada,
  IconeExcluir,
  IconeSaida,
} from "@/components/icones";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { formatarDataHoraBr } from "@/app/produtos/tipos";
import Link from "next/link";

import ControlesListaTransferencias from "./ControlesListaTransferencias";
import { excluirPedidoTransferencia } from "./actions";
import {
  CLASSE_STATUS_TRANSFERENCIA,
  ROTULO_STATUS_TRANSFERENCIA,
} from "./tipos";

export const dynamic = "force-dynamic";

const TAMANHOS_PAGINA = [10, 25, 50, 75, 100] as const;
const TAMANHO_PADRAO = 10;
type ColunaOrdenacao =
  | "id"
  | "locais"
  | "solicitante"
  | "criadoEm"
  | "status";
type DirecaoOrdenacao = "asc" | "desc";
type FiltroStatus =
  | "TODOS"
  | "PENDENTES"
  | "EM_TRANSITO"
  | "CONCLUIDOS"
  | "ABERTOS";

function normalizarFiltroStatus(valor: string): FiltroStatus {
  if (valor === "TODOS") return "TODOS";
  if (valor === "PENDENTES" || valor === "PENDENTE") return "PENDENTES";
  if (valor === "EM_TRANSITO") return "EM_TRANSITO";
  if (valor === "CONCLUIDOS" || valor === "CONCLUIDO") return "CONCLUIDOS";
  return "ABERTOS";
}

function parametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? "");
}

function dataIsoValida(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "";
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor
    ? ""
    : valor;
}

function inicioDoDiaEmSaoPaulo(data: string): Date {
  return new Date(`${data}T00:00:00.000-03:00`);
}

function inicioDoDiaSeguinteEmSaoPaulo(data: string): Date {
  const diaSeguinte = new Date(`${data}T00:00:00.000Z`);
  diaSeguinte.setUTCDate(diaSeguinte.getUTCDate() + 1);
  return inicioDoDiaEmSaoPaulo(diaSeguinte.toISOString().slice(0, 10));
}

export default async function TransferenciasPage({
  searchParams,
}: PageProps<"/transferencias">) {
  const atual = await exigirPermissao("transferencias.pedido.consultar");
  const parametros = await searchParams;
  const filtroStatus = normalizarFiltroStatus(parametro(parametros.status));
  const ordenacaoInformada = parametro(parametros.ordenacao);
  const ordenacao: ColunaOrdenacao =
    ordenacaoInformada === "id" ||
    ordenacaoInformada === "locais" ||
    ordenacaoInformada === "solicitante" ||
    ordenacaoInformada === "status"
      ? ordenacaoInformada
      : "criadoEm";
  const direcao: DirecaoOrdenacao =
    parametro(parametros.direcao) === "asc" ? "asc" : "desc";
  const buscaTexto = parametro(parametros.busca).trim();
  const dataInicio = dataIsoValida(parametro(parametros.dataInicio));
  const dataFim = dataIsoValida(parametro(parametros.dataFim));
  const tamanhoInformado = Number(parametro(parametros.tamanho));
  const tamanho = (TAMANHOS_PAGINA as readonly number[]).includes(
    tamanhoInformado
  )
    ? tamanhoInformado
    : TAMANHO_PADRAO;
  const paginaInformada = Number(parametro(parametros.pagina));
  const paginaInicial =
    Number.isSafeInteger(paginaInformada) && paginaInformada > 0
      ? paginaInformada
      : 1;
  const filtroStatusWhere: Prisma.PedidoTransferenciaWhereInput =
    filtroStatus === "PENDENTES"
      ? { status: "PENDENTE" }
      : filtroStatus === "EM_TRANSITO"
        ? { status: "EM_TRANSITO" }
        : filtroStatus === "CONCLUIDOS"
          ? { status: "CONCLUIDO" }
          : filtroStatus === "ABERTOS"
            ? { status: { in: ["PENDENTE", "EM_TRANSITO"] } }
            : {};
  const condicoes: Prisma.PedidoTransferenciaWhereInput[] = [];
  if (filtroStatus !== "TODOS") condicoes.push(filtroStatusWhere);
  if (buscaTexto !== "") {
    condicoes.push({
      OR: [
        {
          solicitante: {
            is: { nome: { contains: buscaTexto, mode: "insensitive" } },
          },
        },
        {
          enviadoPor: {
            is: { nome: { contains: buscaTexto, mode: "insensitive" } },
          },
        },
        {
          recebidoPor: {
            is: { nome: { contains: buscaTexto, mode: "insensitive" } },
          },
        },
      ],
    });
  }
  if (dataInicio || dataFim) {
    condicoes.push({
      criadoEm: {
        ...(dataInicio ? { gte: inicioDoDiaEmSaoPaulo(dataInicio) } : {}),
        ...(dataFim ? { lt: inicioDoDiaSeguinteEmSaoPaulo(dataFim) } : {}),
      },
    });
  }
  const where: Prisma.PedidoTransferenciaWhereInput =
    condicoes.length > 0 ? { AND: condicoes } : {};
  const total = await prisma.pedidoTransferencia.count({ where });
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);
  const orderBy: Prisma.PedidoTransferenciaOrderByWithRelationInput[] =
    ordenacao === "locais"
      ? [
          { origem: { nome: direcao } },
          { destino: { nome: direcao } },
          { id: "desc" },
        ]
      : ordenacao === "solicitante"
        ? [{ solicitante: { nome: direcao } }, { id: "desc" }]
        : ordenacao === "status"
          ? [{ status: direcao }, { criadoEm: "desc" }, { id: "desc" }]
          : ordenacao === "id"
            ? [{ id: direcao }]
            : [{ criadoEm: direcao }, { id: direcao }];
  const pedidos = await prisma.pedidoTransferencia.findMany({
    where,
    orderBy,
    skip: (pagina - 1) * tamanho,
    take: tamanho,
    include: {
      origem: { select: { nome: true } },
      destino: { select: { nome: true } },
      solicitante: { select: { nome: true } },
      enviadoPor: { select: { nome: true } },
      recebidoPor: { select: { nome: true } },
      _count: { select: { itens: true } },
    },
  });
  const administrador =
    pedidos.some(
      (pedido) =>
        pedido.status === "PENDENTE" &&
        pedido.solicitanteId !== atual.id
    ) &&
    (await prisma.usuarioCargo.findFirst({
      where: { usuarioId: atual.id, cargo: { nome: "Administrador" } },
      select: { usuarioId: true },
    })) !== null;

  function urlPagina(numero: number) {
    const busca = new URLSearchParams();
    if (filtroStatus !== "ABERTOS") busca.set("status", filtroStatus);
    if (buscaTexto !== "") busca.set("busca", buscaTexto);
    if (dataInicio) busca.set("dataInicio", dataInicio);
    if (dataFim) busca.set("dataFim", dataFim);
    if (tamanho !== TAMANHO_PADRAO) busca.set("tamanho", String(tamanho));
    if (ordenacao !== "criadoEm") busca.set("ordenacao", ordenacao);
    if (direcao !== "desc") busca.set("direcao", direcao);
    busca.set("pagina", String(numero));
    return `/transferencias?${busca.toString()}`;
  }

  function urlOrdenacao(coluna: ColunaOrdenacao) {
    const busca = new URLSearchParams();
    if (filtroStatus !== "ABERTOS") busca.set("status", filtroStatus);
    if (buscaTexto !== "") busca.set("busca", buscaTexto);
    if (dataInicio) busca.set("dataInicio", dataInicio);
    if (dataFim) busca.set("dataFim", dataFim);
    if (tamanho !== TAMANHO_PADRAO) busca.set("tamanho", String(tamanho));
    const proximaDirecao: DirecaoOrdenacao =
      coluna === ordenacao && direcao === "asc" ? "desc" : "asc";
    busca.set("ordenacao", coluna);
    busca.set("direcao", proximaDirecao);
    busca.set("pagina", "1");
    return `/transferencias?${busca.toString()}`;
  }

  const erro = parametro(parametros.erro);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
            Pedidos de transferência
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Transferências entre locais, com envio reservado e recebimento
            registrado.
          </p>
        </div>
        {atual.permissoes.has("transferencias.pedido.solicitar") && (
          <Link
            href="/transferencias/novo"
            className="flex min-h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
          >
            Fazer pedido de transferência
          </Link>
        )}
      </div>

      {erro === "estado" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          O pedido já não está pendente ou você não pode excluí-lo.
        </p>
      )}
      {erro === "falha" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Não foi possível excluir o pedido de transferência.
        </p>
      )}

      <ControlesListaTransferencias
        status={filtroStatus}
        tamanho={tamanho}
        ordenacao={ordenacao}
        direcao={direcao}
        busca={buscaTexto}
        dataInicio={dataInicio}
        dataFim={dataFim}
      >
          <p className="mt-3 text-sm text-zinc-600" role="status">
            {total === 0
              ? "Nenhum pedido de transferência encontrado."
              : `${total} pedido(s) · página ${pagina} de ${totalPaginas}`}
          </p>

          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[850px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-700">
              {(
                [
                  ["id", "Pedido"],
                  ["locais", "Origem / destino"],
                  ["solicitante", "Solicitante"],
                  ["criadoEm", "Data"],
                  ["status", "Status"],
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
                    href={urlOrdenacao(coluna)}
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
              <th scope="col" className="px-3 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-600">
                  Nenhum pedido corresponde aos filtros selecionados.
                </td>
              </tr>
            ) : (
              pedidos.map((pedido) => {
                const podeEditar =
                  pedido.status === "PENDENTE" &&
                  (pedido.solicitanteId === atual.id || administrador);
                return (
                  <tr key={pedido.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      <Link
                        href={`/transferencias/${pedido.id}`}
                        className="underline decoration-zinc-400 underline-offset-2"
                      >
                        #{pedido.id} · {pedido._count.itens} produto(s)
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-zinc-800">
                      <span>{pedido.origem.nome}</span>
                      <span className="mx-2 text-zinc-500" aria-hidden="true">→</span>
                      <span>{pedido.destino.nome}</span>
                    </td>
                    <td className="px-3 py-3 text-zinc-800">
                      <span>{pedido.solicitante.nome}</span>
                      {pedido.enviadoPor && (
                        <span className="block text-xs text-zinc-500">
                          Enviado por {pedido.enviadoPor.nome}
                        </span>
                      )}
                      {pedido.recebidoPor && (
                        <span className="block text-xs text-zinc-500">
                          Recebido por {pedido.recebidoPor.nome}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-800">
                      {formatarDataHoraBr(pedido.criadoEm)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${CLASSE_STATUS_TRANSFERENCIA[pedido.status]}`}
                      >
                        {ROTULO_STATUS_TRANSFERENCIA[pedido.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <LinkAcaoComCarregamento
                          href={`/transferencias/${pedido.id}`}
                          ariaLabel={`${podeEditar ? "Editar" : "Visualizar"} pedido de transferência #${pedido.id}`}
                          title={podeEditar ? "Editar pedido" : "Visualizar pedido"}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 text-zinc-900 hover:bg-zinc-50"
                          tamanhoIconeCarregando="h-4 w-4"
                        >
                          {podeEditar ? (
                            <IconeEditar className="h-4 w-4" />
                          ) : (
                            <IconeDocumento className="h-4 w-4" />
                          )}
                        </LinkAcaoComCarregamento>
                        {pedido.status === "PENDENTE" &&
                          atual.permissoes.has("transferencias.pedido.enviar") && (
                            <LinkAcaoComCarregamento
                              href={`/transferencias/${pedido.id}`}
                              ariaLabel={`Enviar pedido de transferência #${pedido.id}`}
                              title="Enviar pedido"
                              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#002855] text-white"
                              tamanhoIconeCarregando="h-4 w-4"
                            >
                              <IconeSaida className="h-4 w-4" />
                            </LinkAcaoComCarregamento>
                          )}
                        {pedido.status === "EM_TRANSITO" &&
                          atual.permissoes.has("transferencias.pedido.receber") && (
                            <LinkAcaoComCarregamento
                              href={`/transferencias/${pedido.id}`}
                              ariaLabel={`Receber pedido de transferência #${pedido.id}`}
                              title="Receber pedido"
                              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#002855] text-white"
                              tamanhoIconeCarregando="h-4 w-4"
                            >
                              <IconeEntrada className="h-4 w-4" />
                            </LinkAcaoComCarregamento>
                          )}
                        {podeEditar && (
                          <form action={excluirPedidoTransferencia}>
                            <input type="hidden" name="id" value={pedido.id} />
                            <BotaoAcao
                              confirmacao={`Excluir o pedido de transferência #${pedido.id}?`}
                              title="Excluir pedido"
                              ariaLabel={`Excluir pedido de transferência #${pedido.id}`}
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                            >
                              <IconeExcluir className="h-4 w-4" />
                            </BotaoAcao>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <nav
          aria-label="Paginação dos pedidos de transferência"
          className="mt-4 flex items-center justify-between gap-3"
        >
          {pagina > 1 ? (
            <Link
              href={urlPagina(pagina - 1)}
              className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {pagina < totalPaginas ? (
            <Link
              href={urlPagina(pagina + 1)}
              className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      </ControlesListaTransferencias>
    </main>
  );
}

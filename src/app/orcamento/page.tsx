import Link from "next/link";

import { formatarDataHoraBr } from "@/app/produtos/tipos";
import BotaoAcao from "@/components/BotaoAcao";
import LinkAcaoComCarregamento from "@/components/LinkAcaoComCarregamento";
import { IconeDocumento, IconeExcluir, IconeLapis } from "@/components/icones";
import { EstadoEnvioOrcamento } from "@/generated/prisma/enums";
import { dataHojeIso } from "@/app/fornecedores/tipos";
import type {
  SolicitacaoOrcamentoOrderByWithRelationInput,
  SolicitacaoOrcamentoWhereInput,
} from "@/generated/prisma/models";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";

import { excluirSolicitacaoOrcamento } from "./actions";
import BuscaFiltrosOrcamentos from "./BuscaFiltrosOrcamentos";
import { solicitacaoEditavel } from "./tipos";

export const dynamic = "force-dynamic";

const TAMANHOS_PAGINA = [10, 25, 50, 75, 100] as const;
const COLUNAS_ORDENACAO = [
  "id",
  "fornecedor",
  "solicitante",
  "criadoEm",
  "emailStatus",
  "whatsappStatus",
] as const;
const STATUS_ENVIO = Object.values(EstadoEnvioOrcamento);

type ColunaOrdenacao = (typeof COLUNAS_ORDENACAO)[number];
type Direcao = "asc" | "desc";
type ParametrosBusca = {
  busca: string;
  dataInicio: string;
  dataFim: string;
  statusEmail: string;
  statusWhatsApp: string;
  tamanho: number;
  ordenacao: ColunaOrdenacao;
  direcao: Direcao;
};

function parametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function rotuloStatus(status: EstadoEnvioOrcamento): string {
  switch (status) {
    case "ENVIADO":
      return "Enviado";
    case "FALHOU":
      return "Falhou";
    case "PENDENTE":
      return "Pendente";
    case "NAO_SOLICITADO":
      return "Não solicitado";
  }
}

function classeStatus(status: EstadoEnvioOrcamento): string {
  switch (status) {
    case "ENVIADO":
      return "bg-green-100 text-green-800";
    case "FALHOU":
      return "bg-red-100 text-red-800";
    case "PENDENTE":
      return "bg-amber-100 text-amber-900";
    case "NAO_SOLICITADO":
      return "bg-zinc-100 text-zinc-700";
  }
}

function ehStatusEnvio(valor: string): valor is EstadoEnvioOrcamento {
  return STATUS_ENVIO.some((status) => status === valor);
}

function ehDataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function proximoDia(valor: string): string {
  const data = new Date(`${valor}T00:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

export default async function PaginaOrcamento({
  searchParams,
}: PageProps<"/orcamento">) {
  const usuario = await exigirPermissao("orcamentos.orcamento.consultar");
  const parametrosUrl = await searchParams;
  const busca = parametro(parametrosUrl.busca).trim();
  const dataInicioInformada = parametro(parametrosUrl.dataInicio);
  const dataFimInformada = parametro(parametrosUrl.dataFim);
  const dataInicio = ehDataValida(dataInicioInformada)
    ? dataInicioInformada
    : "";
  const dataFim = ehDataValida(dataFimInformada) ? dataFimInformada : "";
  const periodoInvalido = Boolean(dataInicio && dataFim && dataInicio > dataFim);
  const statusEmailInformado = parametro(parametrosUrl.statusEmail);
  const statusWhatsAppInformado = parametro(parametrosUrl.statusWhatsApp);
  const statusEmail = ehStatusEnvio(statusEmailInformado)
    ? statusEmailInformado
    : "";
  const statusWhatsApp = ehStatusEnvio(statusWhatsAppInformado)
    ? statusWhatsAppInformado
    : "";
  const tamanhoInformado = Number(parametro(parametrosUrl.tamanho));
  const tamanho = (TAMANHOS_PAGINA as readonly number[]).includes(
    tamanhoInformado
  )
    ? tamanhoInformado
    : 10;
  const ordenacaoInformada = parametro(parametrosUrl.ordenacao);
  const ordenacao = COLUNAS_ORDENACAO.includes(
    ordenacaoInformada as ColunaOrdenacao
  )
    ? (ordenacaoInformada as ColunaOrdenacao)
    : "criadoEm";
  const direcao: Direcao =
    parametro(parametrosUrl.direcao) === "asc" ? "asc" : "desc";
  const paginaInformada = Number(parametro(parametrosUrl.pagina));
  const paginaInicial =
    Number.isInteger(paginaInformada) && paginaInformada > 0
      ? paginaInformada
      : 1;

  const where: SolicitacaoOrcamentoWhereInput = {};
  if (statusEmail) where.emailStatus = statusEmail;
  if (statusWhatsApp) where.whatsappStatus = statusWhatsApp;
  if (!periodoInvalido && (dataInicio || dataFim)) {
    where.criadoEm = {
      ...(dataInicio
        ? { gte: new Date(`${dataInicio}T00:00:00-03:00`) }
        : {}),
      ...(dataFim
        ? { lt: new Date(`${proximoDia(dataFim)}T00:00:00-03:00`) }
        : {}),
    };
  }
  if (busca) {
    const buscaId = busca.replace(/^ORC-/i, "");
    const buscaUuidCompleto =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        buscaId
      );
    where.OR = [
      {
        fornecedor: {
          is: { nome: { contains: busca, mode: "insensitive" } },
        },
      },
      {
        solicitante: {
          is: { nome: { contains: busca, mode: "insensitive" } },
        },
      },
      ...(buscaUuidCompleto ? [{ id: buscaId }] : []),
    ];
  }

  const total = await prisma.solicitacaoOrcamento.count({ where });
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);
  const ordemPorColuna: Record<
    ColunaOrdenacao,
    SolicitacaoOrcamentoOrderByWithRelationInput
  > = {
    id: { id: direcao },
    fornecedor: { fornecedor: { nome: direcao } },
    solicitante: { solicitante: { nome: direcao } },
    criadoEm: { criadoEm: direcao },
    emailStatus: { emailStatus: direcao },
    whatsappStatus: { whatsappStatus: direcao },
  };
  const solicitacoes = await prisma.solicitacaoOrcamento.findMany({
    where,
    orderBy: [ordemPorColuna[ordenacao], { criadoEm: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * tamanho,
    take: tamanho,
    include: {
      fornecedor: { select: { nome: true } },
      solicitante: { select: { nome: true } },
    },
  });

  const filtros: ParametrosBusca = {
    busca,
    dataInicio,
    dataFim,
    statusEmail,
    statusWhatsApp,
    tamanho,
    ordenacao,
    direcao,
  };

  function urlDaLista(
    extras: Partial<Record<"pagina" | "ordenacao" | "direcao", string>> = {}
  ): string {
    const query = new URLSearchParams();
    if (filtros.busca) query.set("busca", filtros.busca);
    if (filtros.dataInicio) query.set("dataInicio", filtros.dataInicio);
    if (filtros.dataFim) query.set("dataFim", filtros.dataFim);
    if (filtros.statusEmail) query.set("statusEmail", filtros.statusEmail);
    if (filtros.statusWhatsApp) {
      query.set("statusWhatsApp", filtros.statusWhatsApp);
    }
    if (filtros.tamanho !== 10) query.set("tamanho", String(filtros.tamanho));
    if (filtros.ordenacao !== "criadoEm") {
      query.set("ordenacao", filtros.ordenacao);
    }
    if (filtros.direcao !== "desc") query.set("direcao", filtros.direcao);
    for (const [chave, valor] of Object.entries(extras)) {
      query.set(chave, valor);
    }
    const parametros = query.toString();
    return parametros ? `/orcamento?${parametros}` : "/orcamento";
  }

  function urlOrdenacao(coluna: ColunaOrdenacao): string {
    return urlDaLista({
      ordenacao: coluna,
      direcao:
        coluna === ordenacao && direcao === "asc" ? "desc" : "asc",
      pagina: "1",
    });
  }

  function cabecalho(coluna: ColunaOrdenacao, rotulo: string) {
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
          {rotulo}
          <span aria-hidden="true">
            {ordenacao === coluna ? (direcao === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </Link>
      </th>
    );
  }

  const podeEnviar = usuario.permissoes.has("orcamentos.orcamento.enviar");
  const podeEditar = usuario.permissoes.has("orcamentos.orcamento.editar");
  const podeExcluir = usuario.permissoes.has("orcamentos.orcamento.excluir");
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Solicitações de orçamento
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Consulte os orçamentos enviados e o resultado de cada canal.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {usuario.permissoes.has("orcamentos.orcamento.importar") && (
            <Link
              href="/orcamento/importar"
              className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Importar resposta
            </Link>
          )}
          {podeEnviar && (
            <Link
              href="/orcamento/novo"
              className="flex h-12 items-center justify-center rounded-lg bg-[#002855] px-4 text-base font-medium text-white hover:bg-[#124b7e]"
            >
              Novo orçamento
            </Link>
          )}
        </div>
      </header>

      <BuscaFiltrosOrcamentos
        busca={busca}
        dataInicio={dataInicio}
        dataFim={dataFim}
        statusEmail={statusEmail}
        statusWhatsApp={statusWhatsApp}
        tamanho={tamanho}
        ordenacao={ordenacao}
        direcao={direcao}
        opcoesStatus={[
          { valor: "", rotulo: "Todos" },
          ...STATUS_ENVIO.map((status) => ({
            valor: status,
            rotulo: rotuloStatus(status),
          })),
        ]}
        resumo={
          <>
            <p role="status" className="mt-4 text-sm text-zinc-600">
              {total === 0
                ? "Nenhuma solicitação encontrada."
                : `${total} solicitação(ões) — página ${pagina} de ${totalPaginas}`}
            </p>
            {periodoInvalido && (
              <p role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                A data inicial não pode ser posterior à data final.
              </p>
            )}
            {parametro(parametrosUrl.erro) === "solicitacao-ja-enviada" && (
              <p role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                A solicitação não pode ser alterada ou excluída porque o envio foi iniciado ou confirmado.
              </p>
            )}
            {parametro(parametrosUrl.erro) === "solicitacao-invalida" && (
              <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Não foi possível identificar a solicitação para exclusão.
              </p>
            )}
            {parametro(parametrosUrl.erro) === "solicitacao-nao-encontrada" && (
              <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                A solicitação não foi encontrada.
              </p>
            )}
          </>
        }
      >
      {solicitacoes.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
          Ainda não há solicitações de orçamento para os filtros selecionados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr className="border-b border-zinc-200">
                {cabecalho("id", "Solicitação")}
                {cabecalho("fornecedor", "Fornecedor")}
                {cabecalho("solicitante", "Quem criou")}
                {cabecalho("criadoEm", "Quando")}
                {cabecalho("emailStatus", "E-mail")}
                {cabecalho("whatsappStatus", "WhatsApp")}
                <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                  Importação
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map((solicitacao) => {
                const editavel =
                  (podeEditar || podeExcluir) &&
                  solicitacaoEditavel(
                    solicitacao.emailStatus,
                    solicitacao.whatsappStatus
                  );
                return (
                <tr
                  key={solicitacao.id}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="max-w-56 break-all px-3 py-3 font-mono text-xs text-zinc-700">
                    {solicitacao.id}
                  </td>
                  <td className="px-3 py-3 font-medium text-zinc-900">
                    {solicitacao.fornecedor.nome}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    {solicitacao.solicitante.nome}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                    {formatarDataHoraBr(solicitacao.criadoEm)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${classeStatus(solicitacao.emailStatus)}`}
                    >
                      {rotuloStatus(solicitacao.emailStatus)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${classeStatus(solicitacao.whatsappStatus)}`}
                    >
                      {rotuloStatus(solicitacao.whatsappStatus)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                    {solicitacao.importadoEm
                      ? solicitacao.validadeCotacao &&
                        solicitacao.validadeCotacao.toISOString().slice(0, 10) <
                          dataHojeIso()
                        ? "Importado · vencido"
                        : "Importado"
                      : (solicitacao.emailStatus === "ENVIADO" ||
                          solicitacao.whatsappStatus === "ENVIADO") &&
                          solicitacao.emailStatus !== "PENDENTE" &&
                          solicitacao.whatsappStatus !== "PENDENTE"
                        ? "Aguardando resposta"
                        : "Não importado"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {editavel && podeEditar && (
                        <>
                          <LinkAcaoComCarregamento
                            href={`/orcamento/${solicitacao.id}/editar`}
                            title="Editar orçamento"
                            ariaLabel={`Editar orçamento para ${solicitacao.fornecedor.nome}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                            tamanhoIconeCarregando="h-4 w-4"
                          >
                            <IconeLapis className="h-4 w-4" />
                          </LinkAcaoComCarregamento>
                        </>
                      )}
                      {editavel && podeExcluir && (
                        <form action={excluirSolicitacaoOrcamento}>
                          <input
                            type="hidden"
                            name="id"
                            value={solicitacao.id}
                          />
                          <BotaoAcao
                            confirmacao={`Excluir o orçamento para ${solicitacao.fornecedor.nome}? Esta ação não pode ser desfeita.`}
                            ariaLabel={`Excluir orçamento para ${solicitacao.fornecedor.nome}`}
                            title="Excluir orçamento"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                          >
                            <IconeExcluir className="h-4 w-4" />
                          </BotaoAcao>
                        </form>
                      )}
                      <LinkAcaoComCarregamento
                        href={`/orcamento/${solicitacao.id}`}
                        title="Visualizar orçamento"
                        ariaLabel={`Visualizar orçamento para ${solicitacao.fornecedor.nome}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                        tamanhoIconeCarregando="h-4 w-4"
                      >
                        <IconeDocumento className="h-4 w-4" />
                      </LinkAcaoComCarregamento>
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
          aria-label="Paginação das solicitações de orçamento"
          className="mt-4 flex items-center justify-between gap-3"
        >
          {pagina > 1 ? (
            <Link
              href={urlDaLista({ pagina: String(pagina - 1) })}
              data-list-navigation="true"
              className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium"
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-zinc-600">
            {pagina} / {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link
              href={urlDaLista({ pagina: String(pagina + 1) })}
              data-list-navigation="true"
              className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium"
            >
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      </BuscaFiltrosOrcamentos>
    </main>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";

import {
  formatarQuantidade,
  normalizarDecimal,
} from "@/app/produtos/tipos";

import { enviarOrcamentos } from "./actions";
import {
  ROTULO_SITUACAO_ORCAMENTO,
  type LinhaOrcamento,
  type RespostaEnvioOrcamento,
  type ResultadoEnvioOrcamento,
  type SituacaoOrcamento,
} from "./tipos";

type Props = {
  linhas: LinhaOrcamento[];
  podeEnviar: boolean;
};
type FiltroSituacao = "CRITICOS" | "CRITICOS_COMPRAR" | "TODOS";
type ColunaOrdenacao = "nome" | "situacao" | "estoque" | "sugerida";
type Selecao = { quantidade: string; unidade: string };

const ORDEM_SITUACAO: Record<SituacaoOrcamento, number> = {
  CRITICO: 0,
  COMPRAR: 1,
  ADEQUADO: 2,
};
const ROTULO_ESTADO_ENVIO = {
  NAO_SOLICITADO: "Não solicitado",
  PENDENTE: "Pendente",
  ENVIADO: "Enviado",
  FALHOU: "Falhou",
} as const;

function classeEstadoEnvio(status: ResultadoEnvioOrcamento["email"]["status"]) {
  if (status === "ENVIADO") return "text-green-700";
  if (status === "FALHOU") return "text-red-700";
  return "text-zinc-600";
}

function ordenarLinhas(
  primeiro: LinhaOrcamento,
  segundo: LinhaOrcamento,
  coluna: ColunaOrdenacao
): number {
  switch (coluna) {
    case "situacao":
      return (
        ORDEM_SITUACAO[primeiro.situacao] -
          ORDEM_SITUACAO[segundo.situacao] ||
        primeiro.nome.localeCompare(segundo.nome, "pt-BR")
      );
    case "estoque":
      return Number(primeiro.estoque) - Number(segundo.estoque);
    case "sugerida":
      return (
        Number(primeiro.quantidadeSugerida) -
        Number(segundo.quantidadeSugerida)
      );
    case "nome":
      return primeiro.nome.localeCompare(segundo.nome, "pt-BR");
  }
}

function valorQuantidade(texto: string): number {
  const normalizado = normalizarDecimal(texto);
  return normalizado === null ? Number.NaN : Number(normalizado);
}

export default function FormularioOrcamento({ linhas, podeEnviar }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroSituacao, setFiltroSituacao] =
    useState<FiltroSituacao>("CRITICOS_COMPRAR");
  const [ordenacao, setOrdenacao] = useState<ColunaOrdenacao>("situacao");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [selecionados, setSelecionados] = useState<Record<number, Selecao>>({});
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(false);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [erro, setErro] = useState("");
  const [resultados, setResultados] = useState<
    ResultadoEnvioOrcamento[] | null
  >(null);
  const [ocupado, iniciarTransicao] = useTransition();

  const linhasVisiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const filtradas = linhas.filter((linha) => {
      if (
        filtroSituacao === "CRITICOS" &&
        linha.situacao !== "CRITICO"
      ) {
        return false;
      }
      if (
        filtroSituacao === "CRITICOS_COMPRAR" &&
        linha.situacao === "ADEQUADO"
      ) {
        return false;
      }
      return (
        termo === "" ||
        linha.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
        linha.codigoERP?.toLocaleLowerCase("pt-BR").includes(termo)
      );
    });
    filtradas.sort((a, b) => ordenarLinhas(a, b, ordenacao));
    if (direcao === "desc") filtradas.reverse();
    return filtradas;
  }, [busca, direcao, filtroSituacao, linhas, ordenacao]);

  const produtosSelecionados = Object.entries(selecionados)
    .filter(([, selecao]) => selecao !== undefined)
    .map(([produtoId, selecao]) => ({
      produtoId: Number(produtoId),
      quantidade: selecao.quantidade,
      unidade: selecao.unidade,
    }));
  const fornecedoresAfetados = new Set(
    linhas
      .filter((linha) => selecionados[linha.produtoId])
      .flatMap((linha) => linha.fornecedores.map((fornecedor) => fornecedor.id))
  ).size;
  const canaisSelecionados = enviarWhatsApp || enviarEmail;
  const podeAcionarEnvio =
    podeEnviar &&
    produtosSelecionados.length > 0 &&
    canaisSelecionados &&
    !ocupado;

  function alternarOrdenacao(coluna: ColunaOrdenacao) {
    if (ordenacao === coluna) {
      setDirecao((atual) => (atual === "asc" ? "desc" : "asc"));
    } else {
      setOrdenacao(coluna);
      setDirecao("asc");
    }
  }

  function rotuloOrdenacao(coluna: ColunaOrdenacao, rotulo: string) {
    const indicador =
      ordenacao !== coluna ? "" : direcao === "asc" ? " ↑" : " ↓";
    return (
      <button
        type="button"
        onClick={() => alternarOrdenacao(coluna)}
        className="whitespace-nowrap text-left font-semibold hover:text-blue-800"
        aria-label={`Ordenar por ${rotulo} ${
          ordenacao === coluna && direcao === "asc"
            ? "descendente"
            : "ascendente"
        }`}
      >
        {rotulo}
        {indicador}
      </button>
    );
  }

  function prepararEnvio() {
    if (!podeAcionarEnvio) return;
    for (const produto of produtosSelecionados) {
      const quantidade = valorQuantidade(produto.quantidade);
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        setErro("Informe uma quantidade maior que zero para cada produto selecionado.");
        return;
      }
    }

    setErro("");
    setResultados(null);
    iniciarTransicao(async () => {
      const resposta: RespostaEnvioOrcamento = await enviarOrcamentos({
        itens: produtosSelecionados,
        enviarEmail,
        enviarWhatsApp,
        situacaoFiltro: filtroSituacao,
      });
      if (resposta.erro) {
        setErro(resposta.erro);
        return;
      }
      setResultados(resposta.resultados ?? []);
      setSelecionados({});
      setEnviarEmail(false);
      setEnviarWhatsApp(false);
    });
  }

  return (
    <div className="mt-5 flex flex-col gap-5">
      <section
        aria-label="Busca e filtro de produtos"
        className="rounded-xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-base font-semibold text-zinc-900">
          Busca e Filtro
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="busca-orcamento" className="text-sm font-medium text-zinc-800">
              Pesquisar produto
            </label>
            <input
              id="busca-orcamento"
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.currentTarget.value)}
              placeholder="Nome ou código ERP"
              className="h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filtro-situacao-orcamento" className="text-sm font-medium text-zinc-800">
              Situação do estoque
            </label>
            <select
              id="filtro-situacao-orcamento"
              value={filtroSituacao}
              onChange={(evento) =>
                setFiltroSituacao(evento.currentTarget.value as FiltroSituacao)
              }
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
            >
              <option value="CRITICOS">Somente críticos</option>
              <option value="CRITICOS_COMPRAR">Críticos e comprar</option>
              <option value="TODOS">Todos (incluindo estoque adequado)</option>
            </select>
          </div>
        </div>
        <p role="status" className="mt-3 text-sm text-zinc-600">
          {linhasVisiveis.length} produto(s) na lista
          {produtosSelecionados.length > 0 &&
            ` · ${produtosSelecionados.length} selecionado(s) · ${fornecedoresAfetados} fornecedor(es) receberão uma solicitação`}
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-900">Produtos</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Cada fornecedor ativo vinculado receberá uma planilha com os itens
            associados a ele.
          </p>
        </div>
        {linhasVisiveis.length === 0 ? (
          <p className="p-5 text-sm text-zinc-600">
            Nenhum produto corresponde à busca e ao filtro selecionados.
          </p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr className="border-b border-zinc-200">
                  <th scope="col" className="w-12 px-3 py-3">Selecionar</th>
                  <th scope="col" className="px-3 py-3">
                    {rotuloOrdenacao("nome", "Produto")}
                  </th>
                  <th scope="col" className="px-3 py-3">
                    {rotuloOrdenacao("situacao", "Situação")}
                  </th>
                  <th scope="col" className="px-3 py-3">
                    {rotuloOrdenacao("estoque", "Estoque")}
                  </th>
                  <th scope="col" className="px-3 py-3">
                    {rotuloOrdenacao("sugerida", "Sugestão")}
                  </th>
                  <th scope="col" className="px-3 py-3">Fornecedores</th>
                  <th scope="col" className="px-3 py-3">Quantidade para cotação</th>
                </tr>
              </thead>
              <tbody>
                {linhasVisiveis.map((linha) => {
                  const selecao = selecionados[linha.produtoId];
                  const statusClass =
                    linha.situacao === "CRITICO"
                      ? "text-red-700"
                      : linha.situacao === "COMPRAR"
                        ? "text-amber-700"
                        : "text-green-700";
                  return (
                    <tr
                      key={linha.produtoId}
                      className="border-b border-zinc-100 align-top last:border-0"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selecao)}
                          onChange={(evento) => {
                            const marcado = evento.target.checked;
                            setErro("");
                            setSelecionados((atual) => {
                              const novo = { ...atual };
                              if (marcado) {
                                novo[linha.produtoId] = {
                                  quantidade: "",
                                  unidade: "BASE",
                                };
                              } else {
                                delete novo[linha.produtoId];
                              }
                              return novo;
                            });
                          }}
                          aria-label={`Selecionar ${linha.nome} para cotação`}
                          className="h-5 w-5 accent-[#002855]"
                        />
                      </td>
                      <td className="max-w-64 px-3 py-3">
                        <p className="font-medium text-zinc-900">{linha.nome}</p>
                        {linha.codigoERP && (
                          <p className="mt-1 text-xs text-zinc-500">
                            Código ERP: {linha.codigoERP}
                          </p>
                        )}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-3 font-medium ${statusClass}`}>
                        {ROTULO_SITUACAO_ORCAMENTO[linha.situacao]}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                        {formatarQuantidade(Number(linha.estoque))} {linha.unidadeBase}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                        {formatarQuantidade(Number(linha.quantidadeSugerida))} {linha.unidadeBase}
                      </td>
                      <td className="max-w-64 px-3 py-3 text-zinc-700">
                        {linha.fornecedores.length > 0
                          ? linha.fornecedores.map((f) => f.nome).join(", ")
                          : "Sem fornecedor ativo vinculado"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-64 gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={selecao?.quantidade ?? ""}
                            disabled={!selecao}
                            onChange={(evento) => {
                              const quantidade = evento.currentTarget.value;
                              setSelecionados((atual) => ({
                                ...atual,
                                [linha.produtoId]: {
                                  ...atual[linha.produtoId],
                                  quantidade,
                                },
                              }));
                            }}
                            aria-label={`Quantidade de ${linha.nome}`}
                            placeholder="Quantidade"
                            className="h-10 min-w-0 w-28 rounded-lg border border-zinc-300 px-2 text-sm disabled:bg-zinc-100"
                          />
                          <select
                            value={selecao?.unidade ?? "BASE"}
                            disabled={!selecao}
                            onChange={(evento) => {
                              const unidade = evento.target.value;
                              setSelecionados((atual) => ({
                                ...atual,
                                [linha.produtoId]: {
                                  ...atual[linha.produtoId],
                                  unidade,
                                },
                              }));
                            }}
                            aria-label={`Embalagem para ${linha.nome}`}
                            className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 text-sm disabled:bg-zinc-100"
                          >
                            {linha.unidades.map((unidade) => (
                              <option key={unidade.valor} value={unidade.valor}>
                                {unidade.rotulo}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-base font-semibold text-zinc-900">Forma de envio</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-6">
          <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={enviarWhatsApp}
              onChange={(evento) => setEnviarWhatsApp(evento.currentTarget.checked)}
              className="h-5 w-5 accent-[#002855]"
            />
            Enviar WhatsApp
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={enviarEmail}
              onChange={(evento) => setEnviarEmail(evento.currentTarget.checked)}
              className="h-5 w-5 accent-[#002855]"
            />
            Enviar E-mail
          </label>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          O envio será feito a todos os fornecedores ativos vinculados aos
          produtos selecionados. Cada um receberá apenas os seus itens.
        </p>
        <button
          type="button"
          onClick={prepararEnvio}
          disabled={!podeAcionarEnvio}
          className="mt-4 flex h-11 items-center justify-center rounded-lg bg-[#002855] px-5 text-sm font-medium text-white hover:bg-[#124b7e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ocupado ? "Enviando orçamento..." : "Enviar orçamento"}
        </button>
      </section>

      {erro && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      )}

      {resultados && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Resultado do envio
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            A solicitação e os itens foram armazenados para uma futura importação
            da resposta do fornecedor.
          </p>
          <ul className="mt-3 divide-y divide-zinc-100">
            {resultados.map((resultado) => (
              <li key={resultado.id} className="py-3 first:pt-0 last:pb-0">
                <p className="font-medium text-zinc-900">
                  {resultado.fornecedor} · {resultado.quantidadeItens} produto(s)
                </p>
                <p className="mt-1 break-all text-xs text-zinc-500">
                  Solicitação: {resultado.id}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  <p className={classeEstadoEnvio(resultado.email.status)}>
                    E-mail: {ROTULO_ESTADO_ENVIO[resultado.email.status]}
                    {resultado.email.detalhe && ` — ${resultado.email.detalhe}`}
                  </p>
                  <p className={classeEstadoEnvio(resultado.whatsapp.status)}>
                    WhatsApp: {ROTULO_ESTADO_ENVIO[resultado.whatsapp.status]}
                    {resultado.whatsapp.detalhe && ` — ${resultado.whatsapp.detalhe}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

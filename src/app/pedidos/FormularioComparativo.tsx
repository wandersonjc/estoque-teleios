"use client";

import {
  useEffect,
  useRef,
  useState,
  useActionState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";

import BotaoAcao from "@/components/BotaoAcao";

import { criarRascunhosCompra } from "./actions";
import {
  converterEntradaUnidade,
  numeroDeEntrada,
  valorDeEntrada,
} from "./conversao-unidade";

type FornecedorComparacao = {
  id: number;
  nome: string;
  precoUnitario: string | null;
  precoInformado: string | null;
  unidadeInformada: string | null;
  fatorConversao: string | null;
  origem: "COTADO" | "PAGO" | null;
  historicoPrecoId: number | null;
  data: string | null;
};

export type LinhaComparacao = {
  produtoId: number;
  nome: string;
  unidade: string;
  unidades: { valor: string; unidade: string; fator: string }[];
  situacao: "CRITICO" | "COMPRAR" | "ADEQUADO";
  estoqueDisponivel: string;
  embalagensEstoque: { id: number; texto: string }[];
  quantidadeACaminho: string;
  pontoReposicao: string | null;
  embalagensPonto: { id: number; texto: string }[];
  quantidadeSugerida: string;
  quantidadeSugeridaValor: string;
  embalagensSugeridas: { id: number; texto: string }[];
  fornecedorEmPedido: string | null;
  fornecedores: FornecedorComparacao[];
};

type ValoresLinha = {
  incluir: boolean;
  fornecedorId: string;
  quantidade: string;
  precoUnitario: string;
  unidadeSelecionada: string;
  erroUnidade?: string;
};

type EstadoFormulario = { erroGeral?: string };
type ColunaOrdenacao = "nome" | "estoque" | "ponto" | "sugerida" | "situacao";

const NOMES_SITUACAO: Record<LinhaComparacao["situacao"], string> = {
  CRITICO: "Crítico",
  COMPRAR: "Comprar",
  ADEQUADO: "Estoque adequado",
};

function rotuloFornecedor(
  fornecedor: FornecedorComparacao,
  unidadeBase: string
): string {
  if (fornecedor.precoUnitario === null) return "Sem preço";
  const detalhePreco =
    fornecedor.precoInformado && fornecedor.unidadeInformada
      ? ` · informado: R$ ${fornecedor.precoInformado}/${fornecedor.unidadeInformada}`
      : "";
  const origem = fornecedor.origem === "PAGO" ? "pago" : "cotado";
  return `R$ ${fornecedor.precoUnitario}/${unidadeBase}${detalhePreco} · ${origem} em ${fornecedor.data}`;
}

function SeletorFornecedor({
  produtoId,
  produto,
  unidadeBase,
  fornecedores,
  selecionado,
  disabled,
  onChange,
}: {
  produtoId: number;
  produto: string;
  unidadeBase: string;
  fornecedores: FornecedorComparacao[];
  selecionado: string;
  disabled: boolean;
  onChange: (fornecedorId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fornecedorSelecionado = fornecedores.find(
    (fornecedor) => String(fornecedor.id) === selecionado
  );
  const indiceSelecionado = fornecedores.findIndex(
    (fornecedor) => String(fornecedor.id) === selecionado
  );

  useEffect(() => {
    if (aberto) itemRefs.current[indiceAtivo]?.focus();
  }, [aberto, indiceAtivo]);

  function abrir(indice = indiceSelecionado >= 0 ? indiceSelecionado : 0) {
    setIndiceAtivo(indice);
    setAberto(true);
  }

  function escolher(indice: number) {
    const fornecedor = fornecedores[indice];
    if (!fornecedor) return;
    onChange(String(fornecedor.id));
    setAberto(false);
    gatilhoRef.current?.focus();
  }

  function navegarLista(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      setAberto(false);
      gatilhoRef.current?.focus();
      return;
    }

    let proximo: number | null = null;
    if (evento.key === "ArrowDown") proximo = (indiceAtivo + 1) % fornecedores.length;
    if (evento.key === "ArrowUp") {
      proximo = (indiceAtivo - 1 + fornecedores.length) % fornecedores.length;
    }
    if (evento.key === "Home") proximo = 0;
    if (evento.key === "End") proximo = fornecedores.length - 1;
    if (proximo !== null) {
      evento.preventDefault();
      setIndiceAtivo(proximo);
    } else if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      escolher(indiceAtivo);
    }
  }

  return (
    <div
      className="relative min-w-56"
      onBlur={(evento) => {
        const proximoFoco = evento.relatedTarget;
        if (
          !(proximoFoco instanceof Node) ||
          !evento.currentTarget.contains(proximoFoco)
        ) {
          setAberto(false);
        }
      }}
    >
      <input
        type="hidden"
        name={`fornecedor_${produtoId}`}
        value={selecionado}
        disabled={disabled}
      />
      <button
        ref={gatilhoRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`fornecedores-${produtoId}`}
        aria-label={`Fornecedor e preço de ${produto}`}
        disabled={disabled}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={(evento) => {
          if (
            !aberto &&
            ["ArrowDown", "ArrowUp", "Enter", " "].includes(evento.key)
          ) {
            evento.preventDefault();
            abrir();
          }
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-left text-sm text-zinc-900 disabled:bg-zinc-100"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {fornecedorSelecionado?.nome ?? "Selecione"}
          </span>
          {fornecedorSelecionado && (
            <span className="block whitespace-normal break-words text-xs font-normal text-zinc-600">
              {rotuloFornecedor(fornecedorSelecionado, unidadeBase)}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="shrink-0 text-zinc-500">
          {aberto ? "▴" : "▾"}
        </span>
      </button>
      {aberto && (
        <div
          id={`fornecedores-${produtoId}`}
          role="listbox"
          aria-label={`Fornecedores disponíveis para ${produto}`}
          onKeyDown={navegarLista}
          className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-64 overflow-y-auto rounded-lg border border-zinc-300 bg-white p-1"
        >
          {fornecedores.map((fornecedor, indice) => (
            <button
              key={fornecedor.id}
              ref={(elemento) => {
                itemRefs.current[indice] = elemento;
              }}
              type="button"
              role="option"
              aria-selected={String(fornecedor.id) === selecionado}
              tabIndex={indiceAtivo === indice ? 0 : -1}
              onMouseMove={() => setIndiceAtivo(indice)}
              onClick={() => escolher(indice)}
              className="block w-full rounded-md px-2 py-2 text-left hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none"
            >
              <span className="block truncate text-sm font-medium text-zinc-900">
                {fornecedor.nome}
              </span>
              <span className="block whitespace-normal break-words text-xs text-zinc-600">
                {rotuloFornecedor(fornecedor, unidadeBase)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function valorInicial(linha: LinhaComparacao): ValoresLinha {
  const primeiroComPreco = linha.fornecedores.find(
    (fornecedor) => fornecedor.precoUnitario !== null
  );
  const sugestao = Number(linha.quantidadeSugeridaValor);
  const unidadeComPreco = primeiroComPreco
    ? linha.unidades.find(
        (unidade) =>
          unidade.unidade === primeiroComPreco.unidadeInformada &&
          unidade.fator === primeiroComPreco.fatorConversao
      )
    : undefined;
  const unidadeSelecionada = unidadeComPreco?.valor ?? "BASE";
  const unidade = linha.unidades.find(
    (opcao) => opcao.valor === unidadeSelecionada
  ) ?? linha.unidades[0];
  const convertido = unidade
    ? converterEntradaUnidade(
        linha.quantidadeSugeridaValor,
        primeiroComPreco?.precoUnitario ?? "",
        "1",
        unidade.fator
      )
    : null;
  const precoBase = numeroDeEntrada(primeiroComPreco?.precoUnitario ?? "");
  const precoBaseArredondado =
    precoBase === null ? "" : valorDeEntrada(precoBase, 2);
  return {
    incluir: false,
    fornecedorId: primeiroComPreco ? String(primeiroComPreco.id) : "",
    quantidade:
      sugestao > 0
        ? convertido?.quantidade ??
          linha.quantidadeSugeridaValor.replace(".", ",")
        : "",
    precoUnitario:
      primeiroComPreco && unidadeSelecionada !== "BASE" &&
      primeiroComPreco.precoInformado
        ? primeiroComPreco.precoInformado
        : convertido?.preco ?? precoBaseArredondado,
    unidadeSelecionada:
      convertido || unidadeSelecionada === "BASE" ? unidadeSelecionada : "BASE",
  };
}

function precoNaUnidade(
  fornecedor: FornecedorComparacao | undefined,
  unidade: LinhaComparacao["unidades"][number]
): { valor: string; ajusteNecessario: boolean } {
  if (!fornecedor?.precoUnitario) return { valor: "", ajusteNecessario: false };
  if (
    fornecedor.precoInformado &&
    fornecedor.unidadeInformada === unidade.unidade &&
    fornecedor.fatorConversao === unidade.fator
  ) {
    return { valor: fornecedor.precoInformado, ajusteNecessario: false };
  }
  const precoBase = numeroDeEntrada(fornecedor.precoUnitario);
  if (precoBase === null) return { valor: "", ajusteNecessario: false };
  const convertido = precoBase * Number(unidade.fator);
  return {
    valor: valorDeEntrada(convertido, 2),
    ajusteNecessario:
      Math.abs(convertido * 100 - Math.round(convertido * 100)) > 1e-7,
  };
}

export default function FormularioComparativo({
  linhas,
  busca,
  filtroSituacao,
  tamanho,
  ordenacao,
  direcao,
  podeMontar = true,
  fornecedorFiltroId,
}: {
  linhas: LinhaComparacao[];
  busca: string;
  filtroSituacao: string;
  tamanho: number;
  ordenacao: ColunaOrdenacao;
  direcao: "asc" | "desc";
  podeMontar?: boolean;
  fornecedorFiltroId?: number;
}) {
  const [estado, enviar, pendente] = useActionState<
    EstadoFormulario,
    FormData
  >(criarRascunhosCompra, {});
  const [valores, setValores] = useState(
    () =>
      Object.fromEntries(
        linhas.map((linha) => [
          linha.produtoId,
          valorInicial(linha),
        ])
      ) as Record<number, ValoresLinha>
  );

  function atualizarLinha(produtoId: number, atualizacao: Partial<ValoresLinha>) {
    setValores((atuais) => ({
      ...atuais,
      [produtoId]: { ...atuais[produtoId], ...atualizacao },
    }));
  }

  function alterarUnidade(linha: LinhaComparacao, novoValor: string) {
    const atual = valores[linha.produtoId] ?? valorInicial(linha);
    const unidadeAtual = linha.unidades.find(
      (unidade) => unidade.valor === atual.unidadeSelecionada
    );
    const novaUnidade = linha.unidades.find(
      (unidade) => unidade.valor === novoValor
    );
    if (!unidadeAtual || !novaUnidade) return;

    const convertido = converterEntradaUnidade(
      atual.quantidade,
      atual.precoUnitario,
      unidadeAtual.fator,
      novaUnidade.fator
    );
    if (!convertido) {
      atualizarLinha(linha.produtoId, {
        erroUnidade:
          "A quantidade precisa ser válida e conversível em até 3 casas decimais. Ajuste antes de trocar a unidade.",
      });
      return;
    }

    atualizarLinha(linha.produtoId, {
      unidadeSelecionada: novoValor,
      quantidade: convertido.quantidade,
      precoUnitario: convertido.preco,
      erroUnidade: convertido.ajustePrecoNecessario
        ? "O preço convertido foi arredondado para centavos. Confira ou ajuste o preço antes de incluir este produto."
        : undefined,
    });
  }

  function urlOrdenacao(coluna: ColunaOrdenacao) {
    const parametros = new URLSearchParams();
    if (busca) parametros.set("busca", busca);
    if (filtroSituacao) parametros.set("situacao", filtroSituacao);
    if (fornecedorFiltroId) {
      parametros.set("fornecedor", String(fornecedorFiltroId));
    }
    if (tamanho !== 10) parametros.set("tamanho", String(tamanho));
    parametros.set("ordenacao", coluna);
    parametros.set(
      "direcao",
      coluna === ordenacao && direcao === "asc" ? "desc" : "asc"
    );
    parametros.set("pagina", "1");
    return `/pedidos/comparar?${parametros.toString()}`;
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
          className="inline-flex items-center gap-1 hover:text-zinc-900"
        >
          {rotulo}
          <span aria-hidden="true">
            {ordenacao === coluna ? (direcao === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </Link>
      </th>
    );
  }

  if (linhas.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        Nenhum produto foi encontrado com os filtros atuais e parâmetros de reposição configurados.
      </p>
    );
  }

  return (
    <form
      action={enviar}
      onSubmit={(evento) => {
        const possuiErro = linhas.some(
          (linha) =>
            valores[linha.produtoId]?.incluir &&
            valores[linha.produtoId]?.erroUnidade
        );
        if (possuiErro) evento.preventDefault();
      }}
    >
      {estado.erroGeral && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {estado.erroGeral}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr className="border-b border-zinc-200">
              <th scope="col" className="px-3 py-3 font-semibold">Incluir</th>
              {cabecalho("nome", "Produto")}
              {cabecalho("estoque", "Estoque")}
              {cabecalho("ponto", "Ponto de reposição")}
              {cabecalho("sugerida", "Sugestão")}
              {cabecalho("situacao", "Situação")}
              <th scope="col" className="px-3 py-3 font-semibold">Fornecedor e preço</th>
              <th scope="col" className="px-3 py-3 font-semibold">Quantidade</th>
              <th scope="col" className="px-3 py-3 font-semibold">Preço na unidade selecionada</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const atual =
                valores[linha.produtoId] ??
                valorInicial(linha);
              const unidadeAtual =
                linha.unidades.find(
                  (unidade) => unidade.valor === atual.unidadeSelecionada
                ) ?? linha.unidades[0];
              const bloqueado =
                linha.fornecedorEmPedido !== null ||
                linha.fornecedores.length === 0 ||
                !podeMontar ||
                pendente;

              return (
                <tr
                  key={linha.produtoId}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-3 py-3">
                    {linha.fornecedorEmPedido ? (
                      <span className="text-xs text-zinc-600">
                        Já em pedido {linha.fornecedorEmPedido}
                      </span>
                    ) : (
                      <>
                        <input
                          id={`incluir-${linha.produtoId}`}
                          name={`incluir_${linha.produtoId}`}
                          type="checkbox"
                          value="1"
                          checked={atual.incluir}
                          disabled={bloqueado}
                          onChange={(evento) =>
                            atualizarLinha(linha.produtoId, {
                              incluir: evento.target.checked,
                            })
                          }
                          aria-label={`Incluir ${linha.nome} no pedido`}
                          className="h-5 w-5 accent-zinc-900"
                        />
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3 font-medium text-zinc-900">
                    <div>{linha.nome}</div>
                    <div className="text-xs font-normal text-zinc-500">
                      {linha.unidade} · a caminho {linha.quantidadeACaminho}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {linha.estoqueDisponivel} {linha.unidade}
                    {linha.embalagensEstoque.map((embalagem) => (
                      <div
                        key={embalagem.id}
                        className="mt-1 text-xs text-zinc-500"
                      >
                        {embalagem.texto}
                      </div>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {linha.pontoReposicao
                      ? `${linha.pontoReposicao} ${linha.unidade}`
                      : "Prazo não informado"}
                    {linha.embalagensPonto.map((embalagem) => (
                      <div
                        key={embalagem.id}
                        className="mt-1 text-xs text-zinc-500"
                      >
                        {embalagem.texto}
                      </div>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {linha.quantidadeSugerida} {linha.unidade}
                    {linha.embalagensSugeridas.map((embalagem) => (
                      <div
                        key={embalagem.id}
                        className="mt-1 text-xs text-zinc-500"
                      >
                        {embalagem.texto}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-3">{NOMES_SITUACAO[linha.situacao]}                  </td>
                  <td className="px-3 py-3">
                    <SeletorFornecedor
                      produtoId={linha.produtoId}
                      produto={linha.nome}
                      unidadeBase={linha.unidade}
                      fornecedores={linha.fornecedores}
                      selecionado={atual.fornecedorId}
                      disabled={bloqueado}
                      onChange={(fornecedorId) => {
                        const fornecedor = linha.fornecedores.find(
                          (item) => String(item.id) === fornecedorId
                        );
                        const preco = precoNaUnidade(fornecedor, unidadeAtual);
                        atualizarLinha(linha.produtoId, {
                          fornecedorId,
                          precoUnitario: preco.valor,
                          erroUnidade: preco.ajusteNecessario
                            ? "O preço convertido foi arredondado para centavos. Confira ou ajuste o preço antes de incluir este produto."
                            : undefined,
                        });
                      }}
                    />
                    <input
                      type="hidden"
                      name={`historicoPreco_${linha.produtoId}`}
                      value={
                        linha.fornecedores.find(
                          (fornecedor) =>
                            String(fornecedor.id) === atual.fornecedorId
                        )?.historicoPrecoId ?? ""
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <select
                        name={`unidade_${linha.produtoId}`}
                        value={atual.unidadeSelecionada}
                        disabled={bloqueado}
                        onChange={(evento) =>
                          alterarUnidade(linha, evento.target.value)
                        }
                        aria-label={`Unidade de compra de ${linha.nome}`}
                        className="h-10 min-w-28 rounded-lg border border-zinc-300 bg-white px-2 text-sm disabled:bg-zinc-100"
                      >
                        {linha.unidades.map((unidade) => (
                          <option key={unidade.valor} value={unidade.valor}>
                            {unidade.unidade}
                            {Number(unidade.fator) !== 1
                              ? ` (${new Intl.NumberFormat("pt-BR", {
                                  maximumFractionDigits: 3,
                                }).format(Number(unidade.fator))} ${linha.unidade})`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <input
                        id={`quantidade-${linha.produtoId}`}
                        name={`quantidade_${linha.produtoId}`}
                        type="text"
                        inputMode="decimal"
                        required={atual.incluir}
                        value={atual.quantidade}
                        disabled={bloqueado}
                        onChange={(evento) =>
                          atualizarLinha(linha.produtoId, {
                            quantidade: evento.target.value,
                            erroUnidade: undefined,
                          })
                        }
                        aria-label={`Quantidade de ${linha.nome} em ${unidadeAtual.unidade}`}
                        className="h-11 w-28 rounded-lg border border-zinc-300 px-2 text-sm disabled:bg-zinc-100"
                      />
                      {atual.erroUnidade && (
                        <span role="alert" className="max-w-40 text-xs text-red-700">
                          {atual.erroUnidade}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <label className="sr-only" htmlFor={`preco-${linha.produtoId}`}>
                      Preço unitário de {linha.nome}
                    </label>
                    <input
                      id={`preco-${linha.produtoId}`}
                      name={`preco_${linha.produtoId}`}
                      type="text"
                      inputMode="decimal"
                      required={atual.incluir}
                      value={atual.precoUnitario}
                      disabled={bloqueado}
                      onChange={(evento) =>
                        atualizarLinha(linha.produtoId, {
                          precoUnitario: evento.target.value,
                          erroUnidade: undefined,
                        })
                      }
                      placeholder={atual.fornecedorId ? "0,00" : "Selecione"}
                      className="h-11 w-28 rounded-lg border border-zinc-300 px-2 text-sm disabled:bg-zinc-100"
                    />
                    <div className="mt-1 text-xs text-zinc-500">
                      por {unidadeAtual.unidade}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        O menor preço atual vem pré-selecionado por unidade-base. Ao trocar a
        embalagem, quantidade e preço são convertidos; produtos sem preço não
        são selecionados automaticamente.
      </p>
      {podeMontar && (
        <BotaoAcao className="mt-4 h-12 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white">
          Criar rascunhos por fornecedor
        </BotaoAcao>
      )}
    </form>
  );
}

"use client";

import { useState, useActionState } from "react";
import Link from "next/link";

import BotaoAcao from "@/components/BotaoAcao";

import { criarRascunhosCompra } from "./actions";

type FornecedorComparacao = {
  id: number;
  nome: string;
  precoUnitario: string | null;
  origem: "COTADO" | "PAGO" | null;
  data: string | null;
};

export type LinhaComparacao = {
  produtoId: number;
  nome: string;
  unidade: string;
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
};

type EstadoFormulario = { erroGeral?: string };
type ColunaOrdenacao = "nome" | "estoque" | "ponto" | "sugerida" | "situacao";

const NOMES_SITUACAO: Record<LinhaComparacao["situacao"], string> = {
  CRITICO: "Crítico",
  COMPRAR: "Comprar",
  ADEQUADO: "Estoque adequado",
};

function valorInicial(linha: LinhaComparacao): ValoresLinha {
  const primeiroComPreco = linha.fornecedores.find(
    (fornecedor) => fornecedor.precoUnitario !== null
  );
  const sugestao = Number(linha.quantidadeSugeridaValor);
  return {
    incluir: false,
    fornecedorId: primeiroComPreco ? String(primeiroComPreco.id) : "",
    quantidade:
      sugestao > 0 ? linha.quantidadeSugeridaValor.replace(".", ",") : "",
    precoUnitario: primeiroComPreco?.precoUnitario ?? "",
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
    <form action={enviar}>
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
              <th scope="col" className="px-3 py-3 font-semibold">Preço unitário</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const atual =
                valores[linha.produtoId] ??
                valorInicial(linha);
              const fornecedorAtual = linha.fornecedores.find(
                (fornecedor) => String(fornecedor.id) === atual.fornecedorId
              );
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
                  <td className="px-3 py-3">{NOMES_SITUACAO[linha.situacao]}</td>
                  <td className="px-3 py-3">
                    <label className="sr-only" htmlFor={`fornecedor-${linha.produtoId}`}>
                      Fornecedor de {linha.nome}
                    </label>
                    <select
                      id={`fornecedor-${linha.produtoId}`}
                      name={`fornecedor_${linha.produtoId}`}
                      value={atual.fornecedorId}
                      disabled={bloqueado}
                      onChange={(evento) => {
                        const fornecedor = linha.fornecedores.find(
                          (item) => String(item.id) === evento.target.value
                        );
                        atualizarLinha(linha.produtoId, {
                          fornecedorId: evento.target.value,
                          precoUnitario: fornecedor?.precoUnitario ?? "",
                        });
                      }}
                      className="h-11 min-w-56 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 disabled:bg-zinc-100"
                    >
                      <option value="">Selecione</option>
                      {linha.fornecedores.map((fornecedor) => (
                        <option key={fornecedor.id} value={fornecedor.id}>
                          {fornecedor.nome}
                          {fornecedor.precoUnitario === null
                            ? " · sem preço"
                            : ` · R$ ${fornecedor.precoUnitario} · ${fornecedor.origem === "PAGO" ? "pago" : "cotado"} em ${fornecedor.data}`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <label className="sr-only" htmlFor={`quantidade-${linha.produtoId}`}>
                      Quantidade de {linha.nome}
                    </label>
                    <input
                      id={`quantidade-${linha.produtoId}`}
                      name={`quantidade_${linha.produtoId}`}
                      type="text"
                      inputMode="decimal"
                      value={atual.quantidade}
                      disabled={bloqueado}
                      onChange={(evento) =>
                        atualizarLinha(linha.produtoId, {
                          quantidade: evento.target.value,
                        })
                      }
                      className="h-11 w-28 rounded-lg border border-zinc-300 px-2 text-sm disabled:bg-zinc-100"
                    />
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
                      value={atual.precoUnitario}
                      disabled={bloqueado}
                      onChange={(evento) =>
                        atualizarLinha(linha.produtoId, {
                          precoUnitario: evento.target.value,
                        })
                      }
                      placeholder={fornecedorAtual ? "0,00" : "Selecione"}
                      className="h-11 w-28 rounded-lg border border-zinc-300 px-2 text-sm disabled:bg-zinc-100"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        O menor preço atual vem pré-selecionado. Produtos sem preço não são
        selecionados automaticamente; informe um preço para incluí-los.
      </p>
      {podeMontar && (
        <BotaoAcao className="mt-4 h-12 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white">
          Criar rascunhos por fornecedor
        </BotaoAcao>
      )}
    </form>
  );
}

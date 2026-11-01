"use client";

import { useMemo, useState } from "react";

import BotaoAcao from "@/components/BotaoAcao";
import { IconeCarregando } from "@/components/icones";
import {
  adicionarEmbalagemProduto,
  atualizarEmbalagemProduto,
  definirEmbalagemPrincipal,
  excluirEmbalagemProduto,
} from "./actions";
import { UNIDADES } from "./tipos";

export type EmbalagemProdutoExibicao = {
  id: number;
  codigoBarras: string;
  unidade: string;
  quantidadeBase: string;
  principal: boolean;
};

type Props = {
  produtoId: number;
  unidadeBase: string;
  embalagens: EmbalagemProdutoExibicao[];
  podeEditar: boolean;
  resultado?: string;
};

type ColunaOrdenacao = "codigoBarras" | "unidade" | "quantidadeBase" | "principal";
type DirecaoOrdenacao = "asc" | "desc";

const ROTULOS_RESULTADO: Record<string, string> = {
  adicionada: "Embalagem adicionada.",
  atualizada: "Embalagem atualizada.",
  "principal-atualizada": "Embalagem principal atualizada.",
  excluida: "Embalagem excluída.",
  "codigo-duplicado": "Este código de barras já está associado a outra embalagem.",
  "dados-invalidos": "Confira o código de barras, a unidade e a quantidade equivalente.",
  "nao-encontrada": "A embalagem não foi encontrada. Atualize a página e tente novamente.",
  "produto-nao-encontrado": "O produto não foi encontrado. Atualize a página e tente novamente.",
};

function formatarQuantidade(texto: string): string {
  return Number(texto).toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
  });
}

export default function EmbalagensProduto({
  produtoId,
  unidadeBase,
  embalagens,
  podeEditar,
  resultado,
}: Props) {
  const [coluna, setColuna] = useState<ColunaOrdenacao>("codigoBarras");
  const [direcao, setDirecao] = useState<DirecaoOrdenacao>("asc");

  const ordenadas = useMemo(() => {
    return [...embalagens].sort((a, b) => {
      let comparacao: number;
      if (coluna === "quantidadeBase") {
        comparacao =
          Number(a.quantidadeBase) - Number(b.quantidadeBase);
      } else if (coluna === "principal") {
        comparacao = Number(a.principal) - Number(b.principal);
      } else {
        comparacao = a[coluna].localeCompare(b[coluna], "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (comparacao === 0) {
        comparacao = a.codigoBarras.localeCompare(b.codigoBarras, "pt-BR");
      }
      return direcao === "asc" ? comparacao : -comparacao;
    });
  }, [coluna, direcao, embalagens]);

  function ordenarPor(proximaColuna: ColunaOrdenacao) {
    if (coluna === proximaColuna) {
      setDirecao((atual) => (atual === "asc" ? "desc" : "asc"));
    } else {
      setColuna(proximaColuna);
      setDirecao("asc");
    }
  }

  function cabecalho(rotulo: string, chave: ColunaOrdenacao) {
    const ativo = coluna === chave;
    return (
      <th
        key={chave}
        scope="col"
        aria-sort={
          ativo ? (direcao === "asc" ? "ascending" : "descending") : "none"
        }
        className="whitespace-nowrap px-3 py-3 font-semibold"
      >
        <button
          type="button"
          onClick={() => ordenarPor(chave)}
          className="inline-flex items-center gap-2 hover:text-zinc-900"
        >
          {rotulo}
          <span aria-hidden="true" className="text-xs">
            {ativo ? (direcao === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
      </th>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Embalagens</h2>
        <p className="mt-1 text-sm text-zinc-600">
          A unidade-base é a unidade em que o estoque é contado ({unidadeBase}).
          Para cada embalagem, informe quantas unidades-base ela contém. Por
          exemplo: se uma caixa contém 100 unidades, cadastre a unidade CX e a
          equivalência 100 {unidadeBase}.
        </p>
      </div>

      {resultado && ROTULOS_RESULTADO[resultado] && (
        <p
          role={resultado.includes("duplicado") ||
          resultado.includes("invalidos") ||
          resultado.includes("encontrada") ||
          resultado.includes("encontrado")
            ? "alert"
            : "status"}
          className={`rounded-lg p-3 text-sm ${
            resultado.includes("duplicado") ||
            resultado.includes("invalidos") ||
            resultado.includes("encontrada") ||
            resultado.includes("encontrado")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-800"
          }`}
        >
          {ROTULOS_RESULTADO[resultado]}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr className="border-b border-zinc-200">
              {cabecalho("Código de Barras", "codigoBarras")}
              {cabecalho("Unidade", "unidade")}
              {cabecalho("Equivalência", "quantidadeBase")}
              {cabecalho("Principal", "principal")}
              {podeEditar && (
                <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((embalagem) => {
              const formularioId = `form-embalagem-${embalagem.id}`;
              return (
                <tr
                  key={embalagem.id}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-3 py-2">
                    <input
                      form={formularioId}
                      name="codigoBarras"
                      aria-label={`Código de barras da embalagem ${embalagem.codigoBarras}`}
                      defaultValue={embalagem.codigoBarras}
                      required
                      maxLength={30}
                      disabled={!podeEditar}
                      className="h-10 w-full rounded-md border border-zinc-300 px-2 text-sm disabled:border-transparent disabled:bg-transparent disabled:px-0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {podeEditar ? (
                      <select
                        form={formularioId}
                        name="unidade"
                        defaultValue={embalagem.unidade}
                        aria-label={`Unidade da embalagem ${embalagem.codigoBarras}`}
                        className="h-10 rounded-md border border-zinc-300 bg-white px-2"
                      >
                        {UNIDADES.map((unidade) => (
                          <option key={unidade} value={unidade}>
                            {unidade}
                          </option>
                        ))}
                      </select>
                    ) : (
                      embalagem.unidade
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {podeEditar ? (
                      <div className="flex items-center gap-2">
                        <input
                          form={formularioId}
                          name="quantidadeBase"
                          aria-label={`Equivalência em ${unidadeBase} da embalagem ${embalagem.codigoBarras}`}
                          defaultValue={formatarQuantidade(embalagem.quantidadeBase)}
                          required
                          inputMode="decimal"
                          className="h-10 w-24 rounded-md border border-zinc-300 px-2"
                        />
                        <span className="text-xs text-zinc-500">
                          {unidadeBase}
                        </span>
                      </div>
                    ) : (
                      `${formatarQuantidade(embalagem.quantidadeBase)} ${unidadeBase}`
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <form action={definirEmbalagemPrincipal}>
                      <input type="hidden" name="produtoId" value={produtoId} />
                      <input
                        type="hidden"
                        name="embalagemId"
                        value={embalagem.id}
                      />
                      <BotaoAcao
                        role="switch"
                        ariaChecked={embalagem.principal}
                        ariaLabel={`Definir código ${embalagem.codigoBarras} como principal`}
                        disabled={!podeEditar || embalagem.principal}
                        carregando={
                          <IconeCarregando className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-[#002855]" />
                        }
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002855] disabled:cursor-default ${
                          embalagem.principal ? "bg-green-600" : "bg-zinc-300"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute h-5 w-5 rounded-full bg-white shadow transition-all ${
                            embalagem.principal
                              ? "right-1"
                              : "left-1"
                          }`}
                        />
                      </BotaoAcao>
                    </form>
                  </td>
                  {podeEditar && (
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-2">
                        <form
                          id={formularioId}
                          action={atualizarEmbalagemProduto}
                        >
                          <input
                            type="hidden"
                            name="produtoId"
                            value={produtoId}
                          />
                          <input
                            type="hidden"
                            name="embalagemId"
                            value={embalagem.id}
                          />
                          <BotaoAcao className="inline-flex h-10 min-w-[4.5rem] items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                            Salvar
                          </BotaoAcao>
                        </form>
                        <form action={excluirEmbalagemProduto}>
                          <input
                            type="hidden"
                            name="produtoId"
                            value={produtoId}
                          />
                          <input
                            type="hidden"
                            name="embalagemId"
                            value={embalagem.id}
                          />
                          <BotaoAcao
                            confirmacao={`Excluir o código de barras ${embalagem.codigoBarras} (${embalagem.unidade})?`}
                            className="h-10 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Excluir
                          </BotaoAcao>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {ordenadas.length === 0 && (
              <tr>
                <td
                  colSpan={podeEditar ? 5 : 4}
                  className="px-3 py-8 text-center text-sm text-zinc-500"
                >
                  Nenhuma embalagem cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {podeEditar && (
        <form
          action={adicionarEmbalagemProduto}
          className="rounded-xl border border-zinc-200 bg-white p-4"
        >
          <input type="hidden" name="produtoId" value={produtoId} />
          <h3 className="font-semibold text-zinc-900">Adicionar embalagem</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
              Código de Barras
              <input
                name="codigoBarras"
                required
                maxLength={30}
                className="h-11 rounded-lg border border-zinc-300 px-3 text-base font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
              Unidade
              <select
                name="unidade"
                defaultValue={unidadeBase}
                className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base font-normal"
              >
                {UNIDADES.map((unidade) => (
                  <option key={unidade} value={unidade}>
                    {unidade}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
              Equivale a ({unidadeBase})
              <input
                name="quantidadeBase"
                defaultValue="1"
                required
                inputMode="decimal"
                className="h-11 rounded-lg border border-zinc-300 px-3 text-base font-normal"
              />
            </label>
            <div className="flex items-end">
              <BotaoAcao className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#002855] px-4 text-sm font-medium text-white hover:bg-[#124b7e]">
                Adicionar
              </BotaoAcao>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Informe quantas unidades-base há em cada embalagem. Ex.: se a
            unidade-base é {unidadeBase} e uma caixa contém 100 unidades, use
            unidade CX e equivalência 100. O primeiro código será principal;
            você pode escolher outro pelo interruptor da tabela.
          </p>
        </form>
      )}
    </section>
  );
}

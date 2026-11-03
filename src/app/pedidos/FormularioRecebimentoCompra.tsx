"use client";

import { useActionState } from "react";
import { useState } from "react";

import BotaoAcao from "@/components/BotaoAcao";

import { receberPedidoCompra } from "./actions";
import { converterEntradaUnidade } from "./conversao-unidade";

type ItemRecebimento = {
  id: number;
  produto: string;
  unidade: string;
  unidades: { valor: string; unidade: string; fator: string }[];
  quantidade: string;
  quantidadeRecebida: string;
  pendente: string;
};

function CampoRecebimento({
  item,
  disabled,
}: {
  item: ItemRecebimento;
  disabled: boolean;
}) {
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("BASE");
  const [quantidade, setQuantidade] = useState(item.pendente);
  const [erroConversao, setErroConversao] = useState("");
  const unidadeAtual =
    item.unidades.find((unidade) => unidade.valor === unidadeSelecionada) ??
    item.unidades[0];
  const quantidadeNaUnidadeBase = converterEntradaUnidade(
    quantidade,
    "",
    unidadeAtual?.fator ?? "1",
    "1"
  )?.quantidade;

  function alterarUnidade(novaUnidadeValor: string) {
    const novaUnidade = item.unidades.find(
      (unidade) => unidade.valor === novaUnidadeValor
    );
    if (!unidadeAtual || !novaUnidade) return;
    const convertido = converterEntradaUnidade(
      quantidade,
      "",
      unidadeAtual.fator,
      novaUnidade.fator
    );
    if (!convertido) {
      setUnidadeSelecionada(novaUnidadeValor);
      setQuantidade("");
      setErroConversao(
        "A quantidade anterior não é exata nesta embalagem e foi limpa. Informe a quantidade que chegou."
      );
      return;
    }
    setUnidadeSelecionada(novaUnidadeValor);
    setQuantidade(convertido.quantidade);
    setErroConversao("");
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`receber-${item.id}`} className="text-sm font-medium text-zinc-800">
        Receber agora ({unidadeAtual.unidade})
      </label>
      <div className="flex gap-2">
        <select
          name={`unidade_receber_${item.id}`}
          value={unidadeSelecionada}
          disabled={disabled}
          onChange={(evento) => alterarUnidade(evento.target.value)}
          aria-label={`Unidade de recebimento de ${item.produto}`}
          className="h-12 min-w-24 rounded-lg border border-zinc-300 bg-white px-2 text-sm disabled:bg-zinc-100"
        >
          {item.unidades.map((unidade) => (
            <option key={unidade.valor} value={unidade.valor}>
              {unidade.unidade}
              {Number(unidade.fator) !== 1
                ? ` (${new Intl.NumberFormat("pt-BR", {
                    maximumFractionDigits: 3,
                  }).format(Number(unidade.fator))} ${item.unidade})`
                : ""}
            </option>
          ))}
        </select>
        <input
          id={`receber-${item.id}`}
          name={`receber_${item.id}`}
          type="text"
          inputMode="decimal"
          value={quantidade}
          disabled={disabled}
          onChange={(evento) => {
            setQuantidade(evento.target.value);
            setErroConversao("");
          }}
          aria-label={`Quantidade recebida de ${item.produto} em ${unidadeAtual.unidade}`}
          className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 text-base disabled:bg-zinc-100"
        />
      </div>
      {Number(unidadeAtual.fator) !== 1 && (
        <span className="text-xs text-zinc-500">
          Na unidade-base: {quantidadeNaUnidadeBase ?? "—"} {item.unidade}
        </span>
      )}
      {erroConversao && (
        <span role="status" className="text-xs text-amber-800">
          {erroConversao}
        </span>
      )}
    </div>
  );
}

export default function FormularioRecebimentoCompra({
  pedidoId,
  itens,
  locais,
  localPadraoId,
}: {
  pedidoId: number;
  itens: ItemRecebimento[];
  locais: { id: number; nome: string }[];
  localPadraoId: number;
}) {
  const [estado, receber, pendente] = useActionState(receberPedidoCompra, {});

  return (
    <form action={receber} className="rounded-xl border border-zinc-200 bg-white p-4">
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <h2 className="text-base font-semibold text-zinc-900">Registrar recebimento</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Informe quanto chegou nesta operação. Pode registrar recebimentos
        parciais; somente a quantidade recebida será somada ao estoque.
      </p>
      {estado.erroGeral && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {estado.erroGeral}
        </p>
      )}
      {estado.sucesso && (
        <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {estado.sucesso}
        </p>
      )}
      <fieldset disabled={pendente} className="mt-4 flex flex-col gap-3">
        <div className="flex max-w-md flex-col gap-1">
          <label htmlFor="localEstoqueId" className="text-sm font-medium text-zinc-800">
            Local de entrada
          </label>
          <select
            id="localEstoqueId"
            name="localEstoqueId"
            defaultValue={String(localPadraoId)}
            required
            className="h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base"
          >
            {locais.map((local) => (
              <option key={local.id} value={local.id}>{local.nome}</option>
            ))}
          </select>
        </div>
        {itens.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-[minmax(0,1fr)_12rem]"
          >
            <div>
              <h3 className="font-medium text-zinc-900">{item.produto}</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Pedido: {item.quantidade} {item.unidade} · já recebido:{" "}
                {item.quantidadeRecebida} {item.unidade} · falta: {item.pendente} {item.unidade}
              </p>
            </div>
            <CampoRecebimento item={item} disabled={pendente} />
          </div>
        ))}
        <BotaoAcao className="h-12 w-full rounded-lg bg-zinc-900 px-4 text-base font-medium text-white sm:w-auto">
          Confirmar recebimento
        </BotaoAcao>
      </fieldset>
    </form>
  );
}

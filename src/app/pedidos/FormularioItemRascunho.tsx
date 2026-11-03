"use client";

import { useActionState, useState } from "react";

import BotaoAcao from "@/components/BotaoAcao";

import { removerItemRascunho, salvarItemRascunho } from "./actions";
import { converterEntradaUnidade } from "./conversao-unidade";

type Props = {
  pedidoId: number;
  itemId: number;
  produto: string;
  unidadeBase: string;
  unidades: { valor: string; unidade: string; fator: string }[];
  unidadeSelecionada: string;
  quantidade: string;
  precoUnitario: string;
};

export default function FormularioItemRascunho(props: Props) {
  const [estado, salvar] = useActionState(salvarItemRascunho, {});
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(
    props.unidadeSelecionada
  );
  const [quantidade, setQuantidade] = useState(props.quantidade);
  const [precoUnitario, setPrecoUnitario] = useState(props.precoUnitario);
  const [erroUnidade, setErroUnidade] = useState("");

  function alterarUnidade(novoValor: string) {
    const unidadeAtual = props.unidades.find(
      (unidade) => unidade.valor === unidadeSelecionada
    );
    const novaUnidade = props.unidades.find(
      (unidade) => unidade.valor === novoValor
    );
    if (!unidadeAtual || !novaUnidade) return;

    const convertido = converterEntradaUnidade(
      quantidade,
      precoUnitario,
      unidadeAtual.fator,
      novaUnidade.fator
    );
    if (!convertido) {
      setErroUnidade(
        "A quantidade precisa ser válida e conversível em até 3 casas decimais. Ajuste antes de trocar a unidade."
      );
      return;
    }

    setUnidadeSelecionada(novoValor);
    setQuantidade(convertido.quantidade);
    setPrecoUnitario(convertido.preco);
    setErroUnidade(
      convertido.ajustePrecoNecessario
        ? "O preço convertido foi arredondado para centavos. Confira ou ajuste o preço antes de salvar."
        : ""
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {estado.erroGeral && (
        <p role="alert" className="text-xs text-red-700">{estado.erroGeral}</p>
      )}
      {estado.sucesso && (
        <p role="status" className="text-xs text-green-800">{estado.sucesso}</p>
      )}
      <form
        action={salvar}
        onSubmit={(evento) => {
          if (erroUnidade) evento.preventDefault();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="pedidoId" value={props.pedidoId} />
        <input type="hidden" name="itemId" value={props.itemId} />
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
          Quantidade ({props.produto})
          <span className="flex gap-1">
            <select
              name="unidadeSelecionada"
              value={unidadeSelecionada}
              onChange={(evento) => alterarUnidade(evento.target.value)}
              className="h-10 max-w-36 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
              aria-label={`Unidade de compra de ${props.produto}`}
            >
              {props.unidades.map((unidade) => (
                <option key={unidade.valor} value={unidade.valor}>
                  {unidade.unidade}
                  {Number(unidade.fator) !== 1
                    ? ` (${new Intl.NumberFormat("pt-BR", {
                        maximumFractionDigits: 3,
                      }).format(Number(unidade.fator))} ${props.unidadeBase})`
                    : ""}
                </option>
              ))}
            </select>
            <input
              name="quantidade"
              type="text"
              inputMode="decimal"
              required
              value={quantidade}
              onChange={(evento) => {
                setQuantidade(evento.target.value);
                setErroUnidade("");
              }}
              className="h-10 w-28 rounded-lg border border-zinc-300 px-2 text-sm"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
          Preço por unidade selecionada (R$)
          <input
            name="precoUnitario"
            type="text"
            inputMode="decimal"
            required
            value={precoUnitario}
            onChange={(evento) => {
              setPrecoUnitario(evento.target.value);
              setErroUnidade("");
            }}
            className="h-10 w-28 rounded-lg border border-zinc-300 px-2 text-sm"
          />
        </label>
        {erroUnidade && (
          <p role="alert" className="basis-full text-xs text-red-700">
            {erroUnidade}
          </p>
        )}
        <BotaoAcao className="h-10 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800">
          Salvar item
        </BotaoAcao>
      </form>
      <form action={removerItemRascunho}>
        <input type="hidden" name="pedidoId" value={props.pedidoId} />
        <input type="hidden" name="itemId" value={props.itemId} />
        <BotaoAcao
          confirmacao={`Remover "${props.produto}" do rascunho?`}
          className="h-9 rounded-lg px-2 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Remover item
        </BotaoAcao>
      </form>
    </div>
  );
}

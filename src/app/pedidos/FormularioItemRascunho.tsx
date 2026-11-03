"use client";

import { useActionState } from "react";

import BotaoAcao from "@/components/BotaoAcao";

import { removerItemRascunho, salvarItemRascunho } from "./actions";

type Props = {
  pedidoId: number;
  itemId: number;
  produto: string;
  quantidade: string;
  precoUnitario: string;
};

export default function FormularioItemRascunho(props: Props) {
  const [estado, salvar] = useActionState(salvarItemRascunho, {});

  return (
    <div className="flex flex-col gap-2">
      {estado.erroGeral && (
        <p role="alert" className="text-xs text-red-700">{estado.erroGeral}</p>
      )}
      {estado.sucesso && (
        <p role="status" className="text-xs text-green-800">{estado.sucesso}</p>
      )}
      <form action={salvar} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="pedidoId" value={props.pedidoId} />
        <input type="hidden" name="itemId" value={props.itemId} />
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
          Quantidade ({props.produto})
          <input
            name="quantidade"
            type="text"
            inputMode="decimal"
            required
            defaultValue={props.quantidade}
            className="h-10 w-28 rounded-lg border border-zinc-300 px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
          Preço unitário (R$)
          <input
            name="precoUnitario"
            type="text"
            inputMode="decimal"
            required
            defaultValue={props.precoUnitario}
            className="h-10 w-28 rounded-lg border border-zinc-300 px-2 text-sm"
          />
        </label>
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

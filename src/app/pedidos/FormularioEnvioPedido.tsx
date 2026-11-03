"use client";

import { useActionState } from "react";

import BotaoAcao from "@/components/BotaoAcao";

import { enviarPedidoCompra } from "./actions";

export default function FormularioEnvioPedido({
  pedidoId,
  previsaoPadrao,
  prazoEntregaDias,
}: {
  pedidoId: number;
  previsaoPadrao: string;
  prazoEntregaDias: number | null;
}) {
  const [estado, enviar, pendente] = useActionState(enviarPedidoCompra, {});

  return (
    <form action={enviar} className="rounded-xl border border-zinc-200 bg-white p-4">
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <h2 className="text-base font-semibold text-zinc-900">Enviar ao fornecedor</h2>
      <p className="mt-1 text-sm text-zinc-600">
        O envio não altera o estoque. O preço unitário de cada item será
        registrado como pago no histórico de preços.
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
      <fieldset disabled={pendente} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="previsaoEntrega" className="text-sm font-medium text-zinc-800">
            Previsão de entrega
          </label>
          <input
            id="previsaoEntrega"
            name="previsaoEntrega"
            type="date"
            required
            defaultValue={previsaoPadrao}
            className="h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base"
          />
          {prazoEntregaDias === null && (
            <span className="text-xs text-amber-800">
              Prazo do fornecedor não cadastrado; informe a data manualmente.
            </span>
          )}
        </div>
        <BotaoAcao className="h-12 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white">
          Enviar pedido
        </BotaoAcao>
      </fieldset>
    </form>
  );
}

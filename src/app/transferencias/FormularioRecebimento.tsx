"use client";

import { useActionState, useState } from "react";

import { receberPedidoTransferencia } from "./actions";
import type { EstadoAcaoTransferencia } from "./tipos";
import type { EmbalagemTransferencia } from "./tipos";

type Props = {
  id: number;
  itens: {
    id: number;
    produto: string;
    unidadeBase: string;
    quantidadeEnviada: string;
    quantidadeEnviadaBase: string;
    quantidadeInicialRecebimento: string;
    unidadeEnviada: string;
    embalagemEnviadaId: string;
    embalagens: EmbalagemTransferencia[];
  }[];
};

const ESTADO_VAZIO: EstadoAcaoTransferencia = {};

export default function FormularioRecebimento({ id, itens }: Props) {
  const [estado, receber, pendente] = useActionState(
    receberPedidoTransferencia,
    ESTADO_VAZIO
  );
  const [unidades, setUnidades] = useState(
    Object.fromEntries(itens.map((item) => [item.id, item.embalagemEnviadaId]))
  );
  const [quantidades, setQuantidades] = useState(
    Object.fromEntries(
      itens.map((item) => [item.id, item.quantidadeInicialRecebimento])
    )
  );

  return (
    <form action={receber} className="rounded-xl border border-zinc-200 bg-white p-4">
      <input type="hidden" name="id" value={id} />
      <h2 className="text-base font-semibold text-zinc-900">
        Confirmar recebimento
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Informe a quantidade recebida. Ela pode ser diferente da enviada, mas
        qualquer divergência exige uma justificativa.
      </p>
      {estado.erroGeral && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {estado.erroGeral}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3">
        {itens.map((item) => {
          const embalagem = item.embalagens.find(
            (opcao) => String(opcao.id) === unidades[item.id]
          );
          const unidade = embalagem?.unidade ?? item.unidadeBase;
          return (
          <fieldset
            key={item.id}
            className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-2"
          >
            <legend className="px-1 text-sm font-medium text-zinc-700">
              {item.produto}
            </legend>
            <p className="text-sm text-zinc-600 sm:col-span-2">
              Enviado: {item.quantidadeEnviada} {item.unidadeEnviada}
              {" ("}{item.quantidadeEnviadaBase} {item.unidadeBase}{")"}
            </p>
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`embalagem-recebida-${item.id}`}
                className="text-sm font-medium text-zinc-800"
              >
                Tipo de embalagem
              </label>
              <select
                id={`embalagem-recebida-${item.id}`}
                name={`embalagemRecebida_${item.id}`}
                value={unidades[item.id]}
                onChange={(evento) => {
                  setUnidades((atuais) => ({
                    ...atuais,
                    [item.id]: evento.target.value,
                  }));
                  setQuantidades((atuais) => ({ ...atuais, [item.id]: "" }));
                }}
                className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
              >
                <option value="">Unidade-base ({item.unidadeBase})</option>
                {item.embalagens.map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.unidade} · 1 equivale a {opcao.quantidadeBase}{" "}
                    {item.unidadeBase}
                  </option>
                ))}
              </select>
              <label
                htmlFor={`recebida-${item.id}`}
                className="text-sm font-medium text-zinc-800"
              >
                Quantidade recebida ({unidade})
              </label>
              <input
                id={`recebida-${item.id}`}
                name={`recebida_${item.id}`}
                type="text"
                inputMode="decimal"
                value={quantidades[item.id]}
                onChange={(evento) =>
                  setQuantidades((atuais) => ({
                    ...atuais,
                    [item.id]: evento.target.value,
                  }))
                }
                required
                className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`justificativa-${item.id}`}
                className="text-sm font-medium text-zinc-800"
              >
                Justificativa se diferente da enviada
              </label>
              <textarea
                id={`justificativa-${item.id}`}
                name={`justificativa_${item.id}`}
                maxLength={500}
                rows={2}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
              />
            </div>
          </fieldset>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={pendente}
        className="mt-4 h-12 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:opacity-60"
      >
        {pendente ? "Confirmando recebimento..." : "Concluir transferência"}
      </button>
    </form>
  );
}

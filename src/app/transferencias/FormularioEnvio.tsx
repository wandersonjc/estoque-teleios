"use client";

import { useActionState, useState } from "react";

import { enviarPedidoTransferencia } from "./actions";
import type { EstadoAcaoTransferencia } from "./tipos";
import type { EmbalagemTransferencia } from "./tipos";

type Props = {
  id: number;
  itens: {
    id: number;
    produto: string;
    unidadeBase: string;
    quantidadeSolicitada: string;
    quantidadeSolicitadaBase: string;
    unidadeSolicitada: string;
    quantidadeInicialEnvio: string;
    embalagemSolicitadaId: string;
    embalagens: EmbalagemTransferencia[];
    quantidadeDisponivel: string;
  }[];
};

const ESTADO_VAZIO: EstadoAcaoTransferencia = {};

export default function FormularioEnvio({ id, itens }: Props) {
  const [estado, enviar, pendente] = useActionState(
    enviarPedidoTransferencia,
    ESTADO_VAZIO
  );
  const [unidades, setUnidades] = useState(
    Object.fromEntries(itens.map((item) => [item.id, item.embalagemSolicitadaId]))
  );
  const [quantidades, setQuantidades] = useState(
    Object.fromEntries(itens.map((item) => [item.id, item.quantidadeInicialEnvio]))
  );

  return (
    <form action={enviar} className="rounded-xl border border-zinc-200 bg-white p-4">
      <input type="hidden" name="id" value={id} />
      <h2 className="text-base font-semibold text-zinc-900">Registrar envio</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Informe o que será enviado. As quantidades não podem exceder as
        solicitadas e serão reservadas no estoque de origem. Se a quantidade
        enviada for diferente da solicitada, informe a justificativa.
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
          <div
            key={item.id}
            className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-2"
          >
            <div className="min-w-0 sm:col-span-2">
              <p className="break-words font-medium text-zinc-900">{item.produto}</p>
              <p className="text-sm text-zinc-600">
                Solicitado: {item.quantidadeSolicitada} {item.unidadeSolicitada}
                {" ("}{item.quantidadeSolicitadaBase} {item.unidadeBase}{")"}
              </p>
              <p className="text-sm text-zinc-600">
                Disponível para novo envio neste momento:{" "}
                {item.quantidadeDisponivel} {item.unidadeBase}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`embalagem-enviada-${item.id}`}
                className="text-sm font-medium text-zinc-800"
              >
                Tipo de embalagem
              </label>
              <select
                id={`embalagem-enviada-${item.id}`}
                name={`embalagemEnviada_${item.id}`}
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
                htmlFor={`enviada-${item.id}`}
                className="text-sm font-medium text-zinc-800"
              >
                Quantidade enviada ({unidade})
              </label>
              <input
                id={`enviada-${item.id}`}
                name={`enviada_${item.id}`}
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
                Justificativa (obrigatória se diferente da solicitada)
              </label>
              <textarea
                id={`justificativa-${item.id}`}
                name={`justificativa_${item.id}`}
                maxLength={500}
                rows={2}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
              />
            </div>
          </div>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={pendente}
        className="mt-4 h-12 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:opacity-60"
      >
        {pendente ? "Registrando envio..." : "Confirmar envio"}
      </button>
    </form>
  );
}

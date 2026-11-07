"use client";

import { useActionState } from "react";
import Link from "next/link";

import BotaoAcao from "@/components/BotaoAcao";
import { IconeCarregando } from "@/components/icones";

import {
  analisarRespostaOrcamento,
  confirmarImportacaoOrcamento,
} from "./importacao-actions";
import type {
  DisponibilidadeResposta,
  EstadoImportacaoOrcamento,
} from "./importacao-tipos";

const ESTADO_INICIAL: EstadoImportacaoOrcamento = {};

const ROTULOS_DISPONIBILIDADE: Record<DisponibilidadeResposta, string> = {
  TOTAL: "Total",
  PARCIAL: "Parcial",
  INDISPONIVEL: "Indisponível",
};

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function ImportadorOrcamento() {
  const [analise, analisar, analisando] = useActionState(
    analisarRespostaOrcamento,
    ESTADO_INICIAL
  );
  const [confirmacao, confirmar, confirmando] = useActionState(
    confirmarImportacaoOrcamento,
    ESTADO_INICIAL
  );

  if (confirmacao.sucesso) {
    return (
      <div
        role="status"
        className="mt-5 flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 sm:flex-row sm:items-center sm:justify-between"
      >
        <p>{confirmacao.sucesso}</p>
        <Link
          href="/orcamento"
          className="font-medium text-green-900 underline underline-offset-2"
        >
          Voltar à lista de orçamentos
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-5">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900">
          Selecione a planilha respondida
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Envie o arquivo XLSX original preenchido por este fornecedor. O
          sistema valida a solicitação e os itens antes de mostrar uma prévia.
          Se a validade estiver vazia, será definida para 7 dias após a
          importação; se o prazo estiver vazio, será usado o prazo cadastrado
          para o fornecedor, quando informado.
        </p>
        <form action={analisar} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label
              htmlFor="arquivo-resposta-orcamento"
              className="text-sm font-medium text-zinc-800"
            >
              Arquivo XLSX (máximo 5 MB)
            </label>
            <input
              id="arquivo-resposta-orcamento"
              name="arquivo"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              disabled={analisando || confirmando}
              className="min-h-12 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-800 file:mr-3 file:h-8 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:text-sm file:font-medium file:text-zinc-800"
            />
          </div>
          <BotaoAcao
            disabled={confirmando}
            carregando={
              <span className="inline-flex items-center gap-2">
                <IconeCarregando className="h-4 w-4 animate-spin" />
                Analisando...
              </span>
            }
            className="flex h-12 shrink-0 items-center justify-center rounded-lg bg-[#002855] px-4 text-base font-medium text-white hover:bg-[#124b7e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Analisar arquivo
          </BotaoAcao>
        </form>
        {analise.erro && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {analise.erro}
          </p>
        )}
        {confirmacao.erro && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {confirmacao.erro}
          </p>
        )}
      </section>

      {analise.previa && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Confira os dados da resposta
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Fornecedor identificado</dt>
              <dd className="font-medium text-zinc-900">
                {analise.previa.fornecedor}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Solicitação identificada</dt>
              <dd className="break-all font-mono text-xs text-zinc-800">
                {analise.previa.solicitacaoId}
              </dd>
            </div>
          </dl>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-zinc-500">Validade da cotação</dt>
              <dd className="font-medium text-zinc-900">
                {new Intl.DateTimeFormat("pt-BR", {
                  timeZone: "UTC",
                  dateStyle: "short",
                }).format(
                  new Date(`${analise.previa.validadeCotacao}T00:00:00.000Z`)
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Prazo de entrega</dt>
              <dd className="font-medium text-zinc-900">
                {analise.previa.prazoEntregaDias === null
                  ? "Não informado"
                  : `${analise.previa.prazoEntregaDias} dias`}
              </dd>
              <dd className="mt-1 text-xs text-zinc-500">
                {analise.previa.prazoEntregaInformado === null
                  ? "Prazo do cadastro do fornecedor, sem alteração."
                  : "O prazo informado será salvo nesta cotação e no cadastro do fornecedor."}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Observações</dt>
              <dd className="whitespace-pre-wrap font-medium text-zinc-900">
                {analise.previa.observacoesCotacao || "Nenhuma"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr className="border-b border-zinc-200">
                  <th scope="col" className="px-3 py-2 font-semibold">Produto</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Solicitado</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Disponibilidade</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Disponível</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Preço unitário</th>
                </tr>
              </thead>
              <tbody>
                {analise.previa.itens.map((item) => (
                  <tr
                    key={item.itemId}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-900">
                      {item.produto}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {item.quantidadeSolicitada} {item.unidade}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {ROTULOS_DISPONIBILIDADE[item.disponibilidade]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {item.quantidadeDisponivel} {item.unidade}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {item.precoInformado
                        ? `${FORMATO_MOEDA.format(Number(item.precoInformado))} / ${item.unidade}`
                        : "Sem preço (indisponível)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm text-zinc-600">
            A confirmação registra os preços disponíveis no histórico e não
            cria pedidos nem altera o estoque. Esta solicitação aceita uma
            única importação.
          </p>
          <form action={confirmar} className="mt-4">
            <input
              type="hidden"
              name="importacaoId"
              value={analise.previa.id}
            />
            <BotaoAcao
              confirmacao="Confirmar a importação desta resposta? Os preços e os dados da cotação serão registrados."
              carregando={
                <span className="inline-flex items-center gap-2">
                  <IconeCarregando className="h-4 w-4 animate-spin" />
                  Confirmando...
                </span>
              }
              className="flex h-11 items-center justify-center rounded-lg bg-[#002855] px-4 text-sm font-medium text-white hover:bg-[#124b7e]"
              disabled={analisando || confirmando}
            >
              Confirmar importação
            </BotaoAcao>
          </form>
        </section>
      )}
    </div>
  );
}

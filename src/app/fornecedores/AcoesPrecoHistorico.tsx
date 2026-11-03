"use client";

import { useRef, useState } from "react";

import { IconeExcluir } from "@/components/icones";
import BotaoAcao from "@/components/BotaoAcao";
import {
  atualizarPrecoHistorico,
  excluirPrecoHistorico,
} from "./actions";

type Props = {
  id: number;
  fornecedorId: number;
  precoUnitario: string;
  origem: "COTADO" | "PAGO";
  precoFormatado: string;
  unidadeInformada: string;
  precoBaseFormatado: string;
  unidadeBase: string;
  retorno: string;
  podeGerenciar: boolean;
};

export function CelulaPrecoHistorico({
  id,
  fornecedorId,
  precoUnitario,
  origem,
  precoFormatado,
  unidadeInformada,
  precoBaseFormatado,
  unidadeBase,
  retorno,
  podeGerenciar,
}: Props) {
  const editavel = podeGerenciar && origem === "COTADO";
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(precoUnitario.replace(".", ","));
  const confirmando = useRef(false);
  const equivalente =
    unidadeInformada !== unidadeBase ||
    precoFormatado !== precoBaseFormatado;

  if (!editavel) {
    return (
      <span className="block whitespace-nowrap">
        {precoFormatado} / {unidadeInformada}
        {equivalente && (
          <span className="block text-xs text-zinc-500">
            Equivale a {precoBaseFormatado} / {unidadeBase}
          </span>
        )}
      </span>
    );
  }

  if (!editando) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setValor(precoUnitario.replace(".", ","));
            setEditando(true);
          }}
          title="Editar preço"
          className="block min-h-10 w-full rounded px-1 text-left underline decoration-dotted underline-offset-4 hover:bg-zinc-50"
        >
          {precoFormatado} / {unidadeInformada}
        </button>
        {equivalente && (
          <span className="block text-xs text-zinc-500">
            Equivale a {precoBaseFormatado} / {unidadeBase}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <form action={atualizarPrecoHistorico}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="fornecedorId" value={fornecedorId} />
        <input type="hidden" name="retorno" value={retorno} />
        <input
          autoFocus
          name="precoUnitario"
          type="text"
          inputMode="decimal"
          required
          value={valor}
          onChange={(evento) => setValor(evento.currentTarget.value)}
          onBlur={() => {
            if (!confirmando.current) setEditando(false);
          }}
          onKeyDown={(evento) => {
            if (evento.key === "Escape") {
              evento.preventDefault();
              setEditando(false);
            }
            if (evento.key === "Enter") {
              evento.preventDefault();
              confirmando.current = true;
              evento.currentTarget.form?.requestSubmit();
            }
          }}
          aria-label={`Novo preço por ${unidadeInformada}. Pressione Enter para confirmar ou Escape para cancelar`}
          className="h-10 w-32 rounded-lg border border-zinc-400 px-2 text-base text-zinc-900 outline-none focus:border-zinc-900"
        />
      </form>
      {equivalente && (
        <span className="block text-xs text-zinc-500">
          Equivale a {precoBaseFormatado} / {unidadeBase}
        </span>
      )}
    </div>
  );
}

export function BotaoExcluirPrecoHistorico({
  id,
  fornecedorId,
  origem,
  retorno,
  podeGerenciar,
}: Omit<
  Props,
  | "precoUnitario"
  | "precoFormatado"
  | "unidadeInformada"
  | "precoBaseFormatado"
  | "unidadeBase"
>) {
  const podeExcluir = podeGerenciar && origem === "COTADO";

  return (
    <form action={excluirPrecoHistorico}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="fornecedorId" value={fornecedorId} />
      <input type="hidden" name="retorno" value={retorno} />
      <BotaoAcao
        disabled={!podeExcluir}
        title={
          podeExcluir
            ? "Excluir preço cotado"
            : origem === "PAGO"
              ? "Preço pago vinculado a uma compra não pode ser excluído aqui"
              : "Você não tem permissão para excluir preços"
        }
        ariaLabel={
          podeExcluir
            ? "Excluir preço cotado"
            : origem === "PAGO"
              ? "Preço pago protegido contra exclusão"
              : "Sem permissão para excluir preço"
        }
        confirmacao="Deseja excluir este registro de preço cotado?"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
      >
        <IconeExcluir className="h-5 w-5" />
      </BotaoAcao>
    </form>
  );
}

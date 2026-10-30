"use client";

import { useRef, useState } from "react";

import { IconeExcluir } from "@/components/icones";
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
  retorno: string;
  podeGerenciar: boolean;
};

export function CelulaPrecoHistorico({
  id,
  fornecedorId,
  precoUnitario,
  origem,
  precoFormatado,
  retorno,
  podeGerenciar,
}: Props) {
  const editavel = podeGerenciar && origem === "COTADO";
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(precoUnitario.replace(".", ","));
  const confirmando = useRef(false);

  if (!editavel) {
    return <span className="whitespace-nowrap">{precoFormatado}</span>;
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setValor(precoUnitario.replace(".", ","));
          setEditando(true);
        }}
        title="Editar preço"
        className="block min-h-10 w-full rounded px-1 text-left underline decoration-dotted underline-offset-4 hover:bg-zinc-50"
      >
        {precoFormatado}
      </button>
    );
  }

  return (
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
        aria-label="Novo preço. Pressione Enter para confirmar ou Escape para cancelar"
        className="h-10 w-32 rounded-lg border border-zinc-400 px-2 text-base text-zinc-900 outline-none focus:border-zinc-900"
      />
    </form>
  );
}

export function BotaoExcluirPrecoHistorico({
  id,
  fornecedorId,
  origem,
  retorno,
  podeGerenciar,
}: Omit<Props, "precoUnitario" | "precoFormatado">) {
  const podeExcluir = podeGerenciar && origem === "COTADO";

  return (
    <form action={excluirPrecoHistorico}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="fornecedorId" value={fornecedorId} />
      <input type="hidden" name="retorno" value={retorno} />
      <button
        type="submit"
        disabled={!podeExcluir}
        title={
          podeExcluir
            ? "Excluir preço cotado"
            : origem === "PAGO"
              ? "Preço pago vinculado a uma compra não pode ser excluído aqui"
              : "Você não tem permissão para excluir preços"
        }
        aria-label={
          podeExcluir
            ? "Excluir preço cotado"
            : origem === "PAGO"
              ? "Preço pago protegido contra exclusão"
              : "Sem permissão para excluir preço"
        }
        onClick={(evento) => {
          if (
            podeExcluir &&
            !window.confirm("Deseja excluir este registro de preço cotado?")
          ) {
            evento.preventDefault();
          }
        }}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
      >
        <IconeExcluir className="h-5 w-5" />
      </button>
    </form>
  );
}

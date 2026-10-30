"use client";

import { IconeExcluir } from "@/components/icones";
import { excluirVinculoProdutoFornecedor } from "./actions";

type Props = {
  id: number;
  nomeProduto: string;
  retorno: string;
  podeExcluir: boolean;
};

export default function BotaoExcluirVinculo({
  id,
  nomeProduto,
  retorno,
  podeExcluir,
}: Props) {
  return (
    <form action={excluirVinculoProdutoFornecedor}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="retorno" value={retorno} />
      <button
        type="submit"
        disabled={!podeExcluir}
        title={
          podeExcluir
            ? "Excluir vínculo"
            : "Vínculo com histórico de preços ou compras não pode ser excluído"
        }
        aria-label={
          podeExcluir
            ? `Excluir vínculo de ${nomeProduto}`
            : `Vínculo de ${nomeProduto} não pode ser excluído porque possui histórico`
        }
        onClick={(evento) => {
          if (
            podeExcluir &&
            !window.confirm(`Excluir o vínculo de ${nomeProduto} com este fornecedor?`)
          ) {
            evento.preventDefault();
          }
        }}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
      >
        <IconeExcluir className="h-5 w-5" />
      </button>
    </form>
  );
}

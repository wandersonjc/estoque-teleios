"use client";

import { IconeExcluir } from "@/components/icones";
import BotaoAcao from "@/components/BotaoAcao";
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
      <BotaoAcao
        disabled={!podeExcluir}
        title={
          podeExcluir
            ? "Excluir vínculo"
            : "Vínculo com histórico de preços ou compras não pode ser excluído"
        }
        ariaLabel={
          podeExcluir
            ? `Excluir vínculo de ${nomeProduto}`
            : `Vínculo de ${nomeProduto} não pode ser excluído porque possui histórico`
        }
        confirmacao={`Excluir o vínculo de ${nomeProduto} com este fornecedor?`}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
      >
        <IconeExcluir className="h-5 w-5" />
      </BotaoAcao>
    </form>
  );
}

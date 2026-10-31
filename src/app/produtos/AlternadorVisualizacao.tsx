"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  IconeVisualizacaoCards,
  IconeVisualizacaoTabela,
} from "@/components/icones";

type Props = {
  tabelaAtiva: boolean;
  hrefCards: string;
  hrefTabela: string;
};

export default function AlternadorVisualizacao({
  tabelaAtiva,
  hrefCards,
  hrefTabela,
}: Props) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();

  return (
    <div
      role="group"
      aria-label="Modo de visualização dos produtos"
      className="flex items-center gap-1"
    >
      <button
        type="button"
        title="Visualização em cards"
        aria-label="Visualização em cards"
        aria-pressed={!tabelaAtiva}
        disabled={pendente || !tabelaAtiva}
        onClick={() => iniciarTransicao(() => router.push(hrefCards))}
        className={`flex h-11 w-11 items-center justify-center rounded-lg border ${
          !tabelaAtiva
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        } disabled:opacity-70`}
      >
        <IconeVisualizacaoCards className="h-5 w-5" />
      </button>
      <button
        type="button"
        title="Visualização em tabela"
        aria-label="Visualização em tabela"
        aria-pressed={tabelaAtiva}
        disabled={pendente || tabelaAtiva}
        onClick={() => iniciarTransicao(() => router.push(hrefTabela))}
        className={`flex h-11 w-11 items-center justify-center rounded-lg border ${
          tabelaAtiva
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        } disabled:opacity-70`}
      >
        <IconeVisualizacaoTabela className="h-5 w-5" />
      </button>
    </div>
  );
}

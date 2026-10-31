"use client";

import { useId, useState } from "react";

import { IconeInformacao } from "@/components/icones";

type Props = {
  dataAtualizacao: string | null;
};

export default function DicaEstoque({ dataAtualizacao }: Props) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const texto = dataAtualizacao
    ? `Última atualização em ${dataAtualizacao}`
    : "Nenhuma atualização de estoque registrada.";

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Informação da última atualização do estoque"
        aria-describedby={aberta ? id : undefined}
        aria-expanded={aberta}
        title="Ver última atualização do estoque"
        onClick={() => setAberta((anterior) => !anterior)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
      >
        <IconeInformacao className="h-4 w-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-52 -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-center text-xs font-medium text-white shadow-lg transition-opacity ${
          aberta
            ? "opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        }`}
      >
        {texto}
      </span>
    </span>
  );
}
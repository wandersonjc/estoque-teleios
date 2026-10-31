"use client";

import { useId, useState } from "react";

import { IconeInformacao } from "@/components/icones";

export default function DicaProdutosFornecedor({
  quantidade,
}: {
  quantidade: number;
}) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const texto = `${quantidade} produto${quantidade === 1 ? "" : "s"} vinculado${quantidade === 1 ? "" : "s"}`;

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Informação de produtos vinculados"
        aria-describedby={aberta ? id : undefined}
        aria-expanded={aberta}
        title="Ver produtos vinculados"
        onClick={() => setAberta((anterior) => !anterior)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
      >
        <IconeInformacao className="h-4 w-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-max max-w-56 -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-center text-xs font-medium text-white shadow-lg transition-opacity ${
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
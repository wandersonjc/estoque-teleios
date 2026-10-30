"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

type Aba = "geral" | "produtos" | "precos";

type Props = {
  abaInicial?: string;
  geral: ReactNode;
  produtos: ReactNode;
  precos: ReactNode;
};

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "geral", rotulo: "Geral" },
  { id: "produtos", rotulo: "Produtos" },
  { id: "precos", rotulo: "Preços" },
];

export default function AbasFornecedor({
  abaInicial,
  geral,
  produtos,
  precos,
}: Props) {
  const abaValida = ABAS.find((aba) => aba.id === abaInicial)?.id;
  const [abaAtiva, setAbaAtiva] = useState<Aba>(abaValida ?? "geral");
  const paineis: Record<Aba, ReactNode> = { geral, produtos, precos };

  function navegarPelasAbas(evento: KeyboardEvent<HTMLButtonElement>) {
    const indiceAtual = ABAS.findIndex((aba) => aba.id === abaAtiva);
    let proximoIndice: number;

    switch (evento.key) {
      case "ArrowRight":
        proximoIndice = (indiceAtual + 1) % ABAS.length;
        break;
      case "ArrowLeft":
        proximoIndice = (indiceAtual - 1 + ABAS.length) % ABAS.length;
        break;
      case "Home":
        proximoIndice = 0;
        break;
      case "End":
        proximoIndice = ABAS.length - 1;
        break;
      default:
        return;
    }

    evento.preventDefault();
    const proximaAba = ABAS[proximoIndice];
    setAbaAtiva(proximaAba.id);
    evento.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [proximoIndice]?.focus();
  }

  return (
    <div className="mt-5">
      <div
        role="tablist"
        aria-label="Informações do fornecedor"
        className="flex overflow-x-auto border-b border-zinc-200"
      >
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            id={`aba-fornecedor-${aba.id}`}
            type="button"
            role="tab"
            aria-selected={abaAtiva === aba.id}
            aria-controls={`painel-fornecedor-${aba.id}`}
            tabIndex={abaAtiva === aba.id ? 0 : -1}
            onClick={() => setAbaAtiva(aba.id)}
            onKeyDown={navegarPelasAbas}
            className={`min-h-12 shrink-0 border-b-2 px-4 text-base font-medium transition-colors ${
              abaAtiva === aba.id
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      {ABAS.map((aba) => (
        <section
          key={aba.id}
          id={`painel-fornecedor-${aba.id}`}
          role="tabpanel"
          aria-labelledby={`aba-fornecedor-${aba.id}`}
          tabIndex={0}
          hidden={abaAtiva !== aba.id}
          className="pt-4"
        >
          {paineis[aba.id]}
        </section>
      ))}
    </div>
  );
}

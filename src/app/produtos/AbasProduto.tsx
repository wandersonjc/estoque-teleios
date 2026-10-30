"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

type Aba = "geral" | "estoque" | "fornecedores";

type Props = {
  abaInicial?: string;
  geral: ReactNode;
  estoque: ReactNode;
  fornecedores: ReactNode;
};

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "geral", rotulo: "Geral" },
  { id: "estoque", rotulo: "Estoque" },
  { id: "fornecedores", rotulo: "Fornecedores" },
];

export default function AbasProduto({
  abaInicial,
  geral,
  estoque,
  fornecedores,
}: Props) {
  const [abaAtiva, setAbaAtiva] = useState<Aba>(
    ABAS.some((aba) => aba.id === abaInicial)
      ? (abaInicial as Aba)
      : "geral"
  );
  const paineis: Record<Aba, ReactNode> = { geral, estoque, fornecedores };

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
        aria-label="Informações do produto"
        className="flex overflow-x-auto border-b border-zinc-200"
      >
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            id={`aba-produto-${aba.id}`}
            type="button"
            role="tab"
            aria-selected={abaAtiva === aba.id}
            aria-controls={`painel-produto-${aba.id}`}
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
          id={`painel-produto-${aba.id}`}
          role="tabpanel"
          aria-labelledby={`aba-produto-${aba.id}`}
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

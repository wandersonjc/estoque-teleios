"use client";

import { useState, useTransition } from "react";

import { salvarPreferenciaTema } from "@/app/usuarios/actions";

type Props = {
  temaInicial: "claro" | "escuro";
};

export default function SeletorTema({ temaInicial }: Props) {
  const [temaEscuro, setTemaEscuro] = useState(temaInicial === "escuro");
  const [salvando, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState(false);

  function alternarTema() {
    const proximoTema = temaEscuro ? "claro" : "escuro";
    const temaAnterior = temaEscuro;
    const favicon = document.querySelector<HTMLLinkElement>(
      'link[rel~="icon"]'
    );
    const hrefFaviconAnterior = favicon?.href;
    setTemaEscuro(proximoTema === "escuro");
    document.documentElement.dataset.tema = proximoTema;
    if (favicon) {
      favicon.href =
        proximoTema === "escuro"
          ? "/imagens/logo_atria_favicon_branco.png"
          : "/imagens/logo_atria_favicon.png";
    }
    setErro(false);

    iniciarTransicao(async () => {
      const salvo = await salvarPreferenciaTema(
        proximoTema === "escuro" ? "ESCURO" : "CLARO"
      );

      if (!salvo) {
        setTemaEscuro(temaAnterior);
        document.documentElement.dataset.tema =
          temaAnterior ? "escuro" : "claro";
        if (favicon && hrefFaviconAnterior) {
          favicon.href = hrefFaviconAnterior;
        }
        setErro(true);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-800">
      <span>Tema escuro</span>
      <button
        type="button"
        role="switch"
        aria-label="Tema escuro"
        aria-checked={temaEscuro}
        onClick={alternarTema}
        disabled={salvando}
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          temaEscuro ? "bg-zinc-900" : "bg-zinc-300"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            temaEscuro ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      {erro && (
        <span role="alert" className="text-xs font-normal text-red-700">
          Não foi possível salvar.
        </span>
      )}
    </div>
  );
}
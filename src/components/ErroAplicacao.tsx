"use client";

import { useEffect, useRef, useState } from "react";

import {
  ehBancoIndisponivel,
  MENSAGEM_BANCO_INDISPONIVEL,
} from "@/lib/erro-banco";

type EstadoRelatorio = "enviando" | "enviado" | "falha";
type RelatorioEmAndamento = {
  erro: Error;
  id: string;
  envio: Promise<boolean>;
};

type Props = {
  erro: Error & { digest?: string };
  tentarNovamente: () => void;
};

export default function ErroAplicacao({ erro, tentarNovamente }: Props) {
  const bancoIndisponivel = ehBancoIndisponivel(erro);
  const relatorioAtual = useRef<RelatorioEmAndamento | null>(null);
  const [resultadoRelatorio, setResultadoRelatorio] = useState<{
    erro: Error;
    id: string;
    estado: Exclude<EstadoRelatorio, "enviando">;
  } | null>(null);
  const estadoRelatorio =
    resultadoRelatorio?.erro === erro
      ? resultadoRelatorio.estado
      : "enviando";
  const idRelatorio =
    resultadoRelatorio?.erro === erro ? resultadoRelatorio.id : "";

  useEffect(() => {
    console.error("Erro não tratado na interface:", erro);
  }, [erro]);

  useEffect(() => {
    let relatorio = relatorioAtual.current;
    if (relatorio?.erro !== erro) {
      const id = crypto.randomUUID();
      const envio = fetch("/api/relatorios/erro", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          nome: erro.name,
          mensagem: erro.message,
          pilha: erro.stack ?? "",
          digest: erro.digest ?? "",
          caminho: window.location.pathname,
          ocorridoEm: new Date().toISOString(),
          navegador: navigator.userAgent,
        }),
      })
        .then(async (resposta) => {
          const resultado = (await resposta.json()) as {
            enviado?: boolean;
          };
          return resposta.ok && resultado.enviado === true;
        })
        .catch(() => false);
      relatorio = { erro, id, envio };
      relatorioAtual.current = relatorio;
    }

    let ativo = true;
    void relatorio.envio.then((enviado) => {
      if (ativo) {
        setResultadoRelatorio({
          erro,
          id: relatorio.id,
          estado: enviado ? "enviado" : "falha",
        });
      }
    });

    return () => {
      ativo = false;
    };
  }, [erro]);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-7xl items-center justify-center px-4 py-10">
      <section
        role="alert"
        className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900"
      >
        <h1 className="text-xl font-semibold">
          {bancoIndisponivel
            ? "Sistema temporariamente indisponível"
            : "Não foi possível carregar esta página"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {bancoIndisponivel
            ? MENSAGEM_BANCO_INDISPONIVEL
            : "Ocorreu um erro inesperado. Tente novamente; se o problema continuar, contate o suporte."}
        </p>
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-sm ${
            estadoRelatorio === "falha" ? "text-amber-800" : "text-zinc-600"
          }`}
        >
          {estadoRelatorio === "enviando"
            ? "Enviando um aviso técnico ao suporte..."
            : estadoRelatorio === "enviado"
              ? "O suporte recebeu um aviso deste erro, com o relatório técnico anexado."
              : `Não foi possível avisar o suporte automaticamente. Informe o código ${idRelatorio} ao suporte.`}
        </p>
        <button
          type="button"
          onClick={tentarNovamente}
          className="mt-5 h-11 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

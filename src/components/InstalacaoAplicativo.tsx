"use client";

import { useEffect, useRef, useState } from "react";

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Plataforma = "ios" | "android" | "desktop";

function detectarPlataforma(): Plataforma {
  const agente = navigator.userAgent.toLowerCase();
  if (
    /iphone|ipad|ipod/.test(agente) ||
    (agente.includes("macintosh") && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  return agente.includes("android") ? "android" : "desktop";
}

export default function InstalacaoAplicativo() {
  const eventoInstalacao = useRef<EventoInstalacao | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [instalado, setInstalado] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const [instalacaoDisponivel, setInstalacaoDisponivel] = useState(false);
  const [plataforma, setPlataforma] = useState<Plataforma>("desktop");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const consultaStandalone = window.matchMedia(
      "(display-mode: standalone)"
    );
    const atualizarInstalado = () => {
      const instaladoComoApp =
        consultaStandalone.matches ||
        Boolean(
          (navigator as Navigator & { standalone?: boolean }).standalone
        );
      setInstalado(instaladoComoApp);
      setVerificado(true);
    };
    const capturarInstalacao = (evento: Event) => {
      evento.preventDefault();
      eventoInstalacao.current = evento as EventoInstalacao;
      setInstalacaoDisponivel(true);
    };
    const confirmarInstalacao = () => {
      eventoInstalacao.current = null;
      setInstalacaoDisponivel(false);
      setInstalado(true);
    };

    atualizarInstalado();
    consultaStandalone.addEventListener("change", atualizarInstalado);
    window.addEventListener("beforeinstallprompt", capturarInstalacao);
    window.addEventListener("appinstalled", confirmarInstalacao);

    return () => {
      consultaStandalone.removeEventListener("change", atualizarInstalado);
      window.removeEventListener("beforeinstallprompt", capturarInstalacao);
      window.removeEventListener("appinstalled", confirmarInstalacao);
    };
  }, []);

  async function instalar() {
    const evento = eventoInstalacao.current;
    if (!evento) {
      setErro(null);
      setPlataforma(detectarPlataforma());
      dialogo.current?.showModal();
      return;
    }

    try {
      await evento.prompt();
      const escolha = await evento.userChoice;
      eventoInstalacao.current = null;
      setInstalacaoDisponivel(false);
      if (escolha.outcome === "accepted") {
        setInstalado(true);
      } else {
        setErro("A instalação não foi concluída. Você pode tentar pelo menu do navegador.");
        dialogo.current?.showModal();
      }
    } catch (falha) {
      console.error("Não foi possível iniciar a instalação do Atria:", falha);
      eventoInstalacao.current = null;
      setInstalacaoDisponivel(false);
      setErro("Não foi possível abrir a instalação. Tente pelo menu do navegador.");
      dialogo.current?.showModal();
    }
  }

  if (!verificado || instalado) return null;

  const instrucoes = {
    ios: (
      <>
        Abra o Atria no Safari, toque em <strong>Compartilhar</strong> e
        escolha <strong>Adicionar à Tela de Início</strong>.
      </>
    ),
    android: (
      <>
        Abra o menu do navegador e escolha <strong>Instalar app</strong> ou{" "}
        <strong>Adicionar à tela inicial</strong>. Confirme quando solicitado.
      </>
    ),
    desktop: (
      <>
        Abra o menu do navegador e escolha <strong>Instalar Atria</strong> ou{" "}
        <strong>Instalar aplicativo</strong>. No Chrome ou Edge, a opção também
        pode aparecer na barra de endereço.
      </>
    ),
  }[plataforma];

  return (
    <>
      <button
        type="button"
        onClick={() => void instalar()}
        aria-label={
          instalacaoDisponivel
            ? "Instalar aplicativo Atria"
            : "Como instalar o aplicativo Atria"
        }
        title="Instalar aplicativo"
        className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-white/25 px-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        </svg>
        <span className="hidden sm:inline">Instalar</span>
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-instalacao-atria"
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 backdrop:bg-zinc-950/50"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="titulo-instalacao-atria"
              className="text-lg font-semibold"
            >
              Instalar o Atria
            </h2>
            <button
              type="button"
              aria-label="Fechar instruções de instalação"
              onClick={() => dialogo.current?.close()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          {erro && (
            <p role="status" className="mt-3 text-sm text-amber-800">
              {erro}
            </p>
          )}
          <p className="mt-3 text-sm leading-6 text-zinc-700">{instrucoes}</p>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="mt-5 min-h-10 w-full rounded-lg bg-[#002855] px-4 py-2 text-sm font-medium text-white hover:bg-[#003b78] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002855]"
          >
            Entendi
          </button>
        </div>
      </dialog>
    </>
  );
}

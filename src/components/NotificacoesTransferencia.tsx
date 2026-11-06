"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { MENSAGEM_BANCO_INDISPONIVEL } from "@/lib/erro-banco";

type NotificacaoTransferencia = {
  id: number;
  transferenciaId: number;
  tipo: "SOLICITADO" | "ENVIADO" | "CONCLUIDO";
  mensagem: string;
  criadoEm: string;
  lidaEm: string | null;
};

type RespostaNotificacoes = {
  notificacoes: NotificacaoTransferencia[];
  naoLidas: number;
};

type ConfiguracaoPush = {
  disponivel: boolean;
  publicKey: string | null;
};

const RESPOSTA_VAZIA: RespostaNotificacoes = {
  notificacoes: [],
  naoLidas: 0,
};

function IconeSino() {
  return (
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
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function dataFormatada(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(valor));
}

export default function NotificacoesTransferencia() {
  const router = useRouter();
  const requisicaoAtiva = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(RESPOSTA_VAZIA);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoLeitura, setAtualizandoLeitura] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pushAtivo, setPushAtivo] = useState(false);
  const [pushCarregando, setPushCarregando] = useState(false);
  const [erroPush, setErroPush] = useState<string | null>(null);

  useEffect(() => {
    let montado = true;
    const inicializador = window.setTimeout(() => {
      if (!("serviceWorker" in navigator)) return;
      void navigator.serviceWorker
        .getRegistration("/")
        .then((registro) => registro?.pushManager.getSubscription())
        .then((assinatura) => {
          if (montado) setPushAtivo(Boolean(assinatura));
        })
        .catch(() => {
          if (montado) {
            setErroPush("Não foi possível verificar a assinatura deste dispositivo.");
          }
        });
    }, 0);

    return () => {
      montado = false;
      window.clearTimeout(inicializador);
    };
  }, []);

  const carregar = useCallback(async () => {
    if (requisicaoAtiva.current) return;
    requisicaoAtiva.current = true;
    setCarregando(true);

    try {
      const resposta = await fetch("/api/notificacoes/transferencias", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!resposta.ok) {
        throw new Error(
          resposta.status === 503
            ? MENSAGEM_BANCO_INDISPONIVEL
            : "Não foi possível carregar as notificações."
        );
      }
      const respostaDados = (await resposta.json()) as RespostaNotificacoes;
      setDados(respostaDados);
      setErro(null);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível carregar as notificações."
      );
    } finally {
      requisicaoAtiva.current = false;
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const inicializador = window.setTimeout(() => void carregar(), 0);
    const intervalo = window.setInterval(() => void carregar(), 30_000);
    return () => {
      window.clearTimeout(inicializador);
      window.clearInterval(intervalo);
    };
  }, [carregar]);

  async function marcarComoLidas(id?: number): Promise<boolean> {
    setAtualizandoLeitura(true);
    try {
      const resposta = await fetch("/api/notificacoes/transferencias", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id === undefined ? { todas: true } : { id }),
      });
      if (!resposta.ok) {
        throw new Error(
          resposta.status === 503
            ? MENSAGEM_BANCO_INDISPONIVEL
            : "Não foi possível atualizar as notificações."
        );
      }

      const agora = new Date().toISOString();
      setDados((atuais) => ({
        naoLidas:
          id === undefined
            ? 0
            : Math.max(
                0,
                atuais.naoLidas -
                  (atuais.notificacoes.some(
                    (notificacao) =>
                      notificacao.id === id && notificacao.lidaEm === null
                  )
                    ? 1
                    : 0)
              ),
        notificacoes: atuais.notificacoes.map((notificacao) =>
          (id === undefined || notificacao.id === id) &&
          notificacao.lidaEm === null
            ? { ...notificacao, lidaEm: agora }
            : notificacao
        ),
      }));
      setErro(null);
      return true;
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível atualizar as notificações."
      );
      return false;
    } finally {
      setAtualizandoLeitura(false);
    }
  }

  function abrirNotificacao(
    evento: React.MouseEvent<HTMLAnchorElement>,
    notificacao: NotificacaoTransferencia
  ) {
    if (notificacao.lidaEm) return;
    evento.preventDefault();
    void marcarComoLidas(notificacao.id).then((atualizada) => {
      if (atualizada) router.push(`/transferencias/${notificacao.transferenciaId}`);
    });
  }

  async function alterarPush() {
    setPushCarregando(true);
    setErroPush(null);
    try {
      if (pushAtivo) {
        const registro = await navigator.serviceWorker.getRegistration("/");
        const assinatura = await registro?.pushManager.getSubscription();
        if (assinatura) {
          const endpoint = assinatura.endpoint;
          await assinatura.unsubscribe();
          const resposta = await fetch("/api/notificacoes/push", {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
          if (!resposta.ok) {
            throw new Error("Não foi possível remover a assinatura deste dispositivo.");
          }
        }
        setPushAtivo(false);
        return;
      }

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        throw new Error("Este navegador não oferece suporte a notificações push.");
      }

      const respostaConfiguracao = await fetch("/api/notificacoes/push", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!respostaConfiguracao.ok) {
        throw new Error("Não foi possível carregar a configuração de push.");
      }
      const configuracao =
        (await respostaConfiguracao.json()) as ConfiguracaoPush;
      if (!configuracao.disponivel || !configuracao.publicKey) {
        throw new Error("As notificações push ainda não foram configuradas no servidor.");
      }

      const permissao =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permissao !== "granted") {
        throw new Error(
          permissao === "denied"
            ? "A permissão foi bloqueada nas configurações do navegador."
            : "Permita as notificações para ativá-las neste dispositivo."
        );
      }

      const registro = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const chave = Uint8Array.from(
        atob(configuracao.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (caractere) => caractere.charCodeAt(0)
      );
      const assinatura =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chave,
        }));
      const resposta = await fetch("/api/notificacoes/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assinatura.toJSON()),
      });
      if (!resposta.ok) {
        const resultado = (await resposta.json()) as { erro?: string };
        await assinatura.unsubscribe();
        throw new Error(
          resultado.erro ?? "Não foi possível salvar a assinatura push."
        );
      }
      setPushAtivo(true);
    } catch (falha) {
      setErroPush(
        falha instanceof Error
          ? falha.message
          : "Não foi possível atualizar as notificações push."
      );
    } finally {
      setPushCarregando(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`Notificações${dados.naoLidas > 0 ? `, ${dados.naoLidas} não lidas` : ""}`}
        aria-expanded={aberto}
        aria-controls="painel-notificacoes-transferencia"
        onClick={() => {
          setAberto((valor) => !valor);
          if (!aberto) void carregar();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <IconeSino />
        {dados.naoLidas > 0 && (
          <span className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#ff5a1f] px-1 text-[10px] font-semibold leading-none text-white">
            {dados.naoLidas > 99 ? "99+" : dados.naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <section
          id="painel-notificacoes-transferencia"
          aria-label="Notificações de transferências"
          className="fixed right-2 top-16 z-50 flex max-h-[calc(100dvh-5rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-xl sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:max-h-[min(90vh,48rem)]"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2.5">
            <h2 className="text-xs font-semibold">Notificações</h2>
            <button
              type="button"
              onClick={() => void marcarComoLidas()}
              disabled={dados.naoLidas === 0 || atualizandoLeitura}
              className="text-xs font-medium text-[#002855] hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline"
            >
              Marcar todas como lidas
            </button>
          </div>

          <div className="shrink-0 border-b border-zinc-200 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium">Notificações push</p>
                <p className="text-xs text-zinc-600">
                  {pushAtivo
                    ? "Ativadas neste dispositivo."
                    : "Receba avisos mesmo com o Atria em segundo plano."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void alterarPush()}
                disabled={pushCarregando}
                className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-[#002855] hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
              >
                {pushCarregando
                  ? "Aguarde..."
                  : pushAtivo
                    ? "Desativar"
                    : "Ativar"}
              </button>
            </div>
            {erroPush && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {erroPush}
              </p>
            )}
          </div>

          {erro && (
            <p role="alert" className="shrink-0 px-3 py-2 text-xs text-red-700">
              {erro}
            </p>
          )}
          {carregando && dados.notificacoes.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-zinc-600">
              Carregando notificações...
            </p>
          ) : dados.notificacoes.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-zinc-600">
              Você não tem notificações.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {dados.notificacoes.map((notificacao) => (
                <li key={notificacao.id}>
                  <Link
                    href={`/transferencias/${notificacao.transferenciaId}`}
                    onClick={(evento) =>
                      abrirNotificacao(evento, notificacao)
                    }
                    className={`block border-b border-zinc-100 px-3 py-2.5 transition-colors hover:bg-zinc-50 ${
                      notificacao.lidaEm ? "" : "bg-blue-50/70"
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      {!notificacao.lidaEm && (
                        <span
                          aria-label="Não lida"
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ff5a1f]"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs">{notificacao.mensagem}</span>
                        <time
                          dateTime={notificacao.criadoEm}
                          className="mt-1 block text-[11px] text-zinc-500"
                        >
                          {dataFormatada(notificacao.criadoEm)}
                        </time>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

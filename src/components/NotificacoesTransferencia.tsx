"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
        throw new Error("Não foi possível carregar as notificações.");
      }
      const respostaDados = (await resposta.json()) as RespostaNotificacoes;
      setDados(respostaDados);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar as notificações.");
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
        throw new Error("Não foi possível atualizar as notificações.");
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
    } catch {
      setErro("Não foi possível atualizar as notificações.");
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
          className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold">Notificações</h2>
            <button
              type="button"
              onClick={() => void marcarComoLidas()}
              disabled={dados.naoLidas === 0 || atualizandoLeitura}
              className="text-xs font-medium text-[#002855] hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline"
            >
              Marcar todas como lidas
            </button>
          </div>

          {erro && (
            <p role="alert" className="px-4 py-3 text-sm text-red-700">
              {erro}
            </p>
          )}
          {carregando && dados.notificacoes.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-zinc-600">
              Carregando notificações...
            </p>
          ) : dados.notificacoes.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-zinc-600">
              Você não tem notificações.
            </p>
          ) : (
            <ul className="max-h-[min(28rem,70vh)] overflow-y-auto">
              {dados.notificacoes.map((notificacao) => (
                <li key={notificacao.id}>
                  <Link
                    href={`/transferencias/${notificacao.transferenciaId}`}
                    onClick={(evento) =>
                      abrirNotificacao(evento, notificacao)
                    }
                    className={`block border-b border-zinc-100 px-4 py-3 transition-colors hover:bg-zinc-50 ${
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
                        <span className="block text-sm">{notificacao.mensagem}</span>
                        <time
                          dateTime={notificacao.criadoEm}
                          className="mt-1 block text-xs text-zinc-500"
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

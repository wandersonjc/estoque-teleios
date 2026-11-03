"use client";

import {
  useEffect,
  useRef,
  useTransition,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { IconeCarregando } from "@/components/icones";

type Props = {
  children: ReactNode;
  resumo: ReactNode;
  usuarios: { id: number; nome: string }[];
  modulos: string[];
  acoes: string[];
  valoresIniciais: {
    modulo?: string;
    acao?: string;
    usuario?: string;
    inicio?: string;
    fim?: string;
    busca?: string;
  };
};

export default function FiltrosHistorico({
  children,
  resumo,
  usuarios,
  modulos,
  acoes,
  valoresIniciais,
}: Props) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const timerBusca = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  useEffect(() => {
    const form = formulario.current;
    if (!form) return;

    for (const [nome, valor] of Object.entries(valoresIniciais)) {
      const campo = form.elements.namedItem(nome);
      if (
        campo instanceof HTMLInputElement ||
        campo instanceof HTMLSelectElement
      ) {
        campo.value = valor ?? "";
      }
    }
  }, [valoresIniciais]);

  useEffect(
    () => () => {
      if (timerBusca.current) clearTimeout(timerBusca.current);
    },
    []
  );

  function navegarPara(destino: string) {
    const url = new URL(destino, window.location.origin);
    url.searchParams.delete("pagina");
    const caminho = `${url.pathname}${url.search}`;
    if (`${window.location.pathname}${window.location.search}` === caminho) {
      return;
    }
    iniciarTransicao(() => router.push(caminho, { scroll: false }));
  }

  function navegarComFormulario(form: HTMLFormElement) {
    if (timerBusca.current) clearTimeout(timerBusca.current);

    const parametros = new URLSearchParams();
    new FormData(form).forEach((valor, chave) => {
      if (typeof valor === "string" && valor !== "") {
        parametros.set(chave, valor);
      }
    });
    parametros.delete("pagina");

    const query = parametros.toString();
    navegarPara(query ? `/historico?${query}` : "/historico");
  }

  function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    navegarComFormulario(evento.currentTarget);
  }

  function limparFiltros() {
    const form = formulario.current;
    if (!form) return;
    form.reset();
    navegarPara("/historico");
  }

  function capturarNavegacaoDaLista(evento: MouseEvent<HTMLDivElement>) {
    if (
      evento.defaultPrevented ||
      evento.button !== 0 ||
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey ||
      !(evento.target instanceof Element)
    ) {
      return;
    }

    const link = evento.target.closest<HTMLAnchorElement>(
      'a[data-list-navigation="true"]'
    );
    if (!link || link.target || link.hasAttribute("download")) return;

    evento.preventDefault();
    const url = new URL(link.href);
    iniciarTransicao(() => router.push(`${url.pathname}${url.search}`, { scroll: false }));
  }

  return (
    <div className="mt-4">
      <details className="group rounded-xl border border-zinc-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
          <span>Busca e Filtros</span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
          >
            <path
              fillRule="evenodd"
              d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </summary>

        <form
          ref={formulario}
          action="/historico"
          method="get"
          onSubmit={enviarFormulario}
          className="flex flex-col gap-4 border-t border-zinc-200 p-3 sm:p-4"
        >
          <fieldset disabled={pendente} className="contents">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label
                  htmlFor="busca-historico"
                  className="text-sm font-medium text-zinc-700"
                >
                  Buscar na descrição
                </label>
                <input
                  id="busca-historico"
                  name="busca"
                  type="search"
                  defaultValue={valoresIniciais.busca || ""}
                  placeholder="Ex.: Alterou produto, PF35..."
                  onChange={(evento) => {
                    if (timerBusca.current) clearTimeout(timerBusca.current);
                    const form = evento.currentTarget.form;
                    if (!form) return;
                    timerBusca.current = setTimeout(
                      () => navegarComFormulario(form),
                      400
                    );
                  }}
                  className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="modulo"
                  className="text-sm font-medium text-zinc-700"
                >
                  Módulo
                </label>
                <select
                  id="modulo"
                  name="modulo"
                  defaultValue={valoresIniciais.modulo || ""}
                  onChange={(evento) => {
                    const form = evento.currentTarget.form;
                    if (form) navegarComFormulario(form);
                  }}
                  className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                >
                  <option value="">Todos os módulos</option>
                  {modulos.map((modulo) => (
                    <option key={modulo} value={modulo}>
                      {modulo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="acao"
                  className="text-sm font-medium text-zinc-700"
                >
                  Ação
                </label>
                <select
                  id="acao"
                  name="acao"
                  defaultValue={valoresIniciais.acao || ""}
                  onChange={(evento) => {
                    const form = evento.currentTarget.form;
                    if (form) navegarComFormulario(form);
                  }}
                  className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                >
                  <option value="">Todas as ações</option>
                  {acoes.map((acao) => (
                    <option key={acao} value={acao}>
                      {acao}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="usuario"
                  className="text-sm font-medium text-zinc-700"
                >
                  Usuário
                </label>
                <select
                  id="usuario"
                  name="usuario"
                  defaultValue={valoresIniciais.usuario || ""}
                  onChange={(evento) => {
                    const form = evento.currentTarget.form;
                    if (form) navegarComFormulario(form);
                  }}
                  className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                >
                  <option value="">Todos os usuários</option>
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="inicio"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Início
                  </label>
                  <input
                    id="inicio"
                    name="inicio"
                    type="date"
                    defaultValue={valoresIniciais.inicio || ""}
                    onChange={(evento) => {
                      const form = evento.currentTarget.form;
                      if (form) navegarComFormulario(form);
                    }}
                    className="h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="fim"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Fim
                  </label>
                  <input
                    id="fim"
                    name="fim"
                    type="date"
                    defaultValue={valoresIniciais.fim || ""}
                    onChange={(evento) => {
                      const form = evento.currentTarget.form;
                      if (form) navegarComFormulario(form);
                    }}
                    className="h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3">
              <button
                type="submit"
                className="h-11 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={limparFiltros}
                className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Limpar buscas e filtros
              </button>
            </div>
          </fieldset>
        </form>
      </details>

      {resumo}

      {pendente ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex min-h-28 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600"
        >
          <IconeCarregando className="h-5 w-5 animate-spin" />
          Carregando...
        </div>
      ) : (
        <div onClickCapture={capturarNavegacaoDaLista}>{children}</div>
      )}
    </div>
  );
}

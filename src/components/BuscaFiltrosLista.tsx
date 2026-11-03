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
  rota: "/cargos" | "/funcoes";
  idBusca: string;
  entidade: string;
  placeholder: string;
  labelTamanho: string;
  busca: string;
  tamanho: number;
  tamanhos: readonly number[];
  ordenacao: string;
  direcao: "asc" | "desc";
};

export default function BuscaFiltrosLista({
  children,
  resumo,
  rota,
  idBusca,
  entidade,
  placeholder,
  labelTamanho,
  busca,
  tamanho,
  tamanhos,
  ordenacao,
  direcao,
}: Props) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const timerBusca = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  useEffect(() => {
    const form = formulario.current;
    if (!form) return;

    const campoBusca = form.elements.namedItem("busca");
    if (campoBusca instanceof HTMLInputElement) campoBusca.value = busca;
    const campoTamanho = form.elements.namedItem("tamanho");
    if (campoTamanho instanceof HTMLSelectElement) {
      campoTamanho.value = String(tamanho);
    }
    const campoOrdenacao = form.elements.namedItem("ordenacao");
    if (campoOrdenacao instanceof HTMLInputElement) {
      campoOrdenacao.value = ordenacao;
    }
    const campoDirecao = form.elements.namedItem("direcao");
    if (campoDirecao instanceof HTMLInputElement) {
      campoDirecao.value = direcao;
    }
  }, [busca, direcao, ordenacao, tamanho]);

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
    navegarPara(query ? `${rota}?${query}` : rota);
  }

  function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    navegarComFormulario(evento.currentTarget);
  }

  function limparFiltros() {
    const form = formulario.current;
    if (!form) return;

    const campoBusca = form.elements.namedItem("busca");
    if (campoBusca instanceof HTMLInputElement) campoBusca.value = "";
    navegarComFormulario(form);
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
    navegarPara(link.href);
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
          action={rota}
          method="get"
          onSubmit={enviarFormulario}
          className="flex flex-col gap-3 border-t border-zinc-200 p-3"
        >
          <fieldset disabled={pendente} className="contents">
            <input type="hidden" name="ordenacao" value={ordenacao} />
            <input type="hidden" name="direcao" value={direcao} />

            <div className="flex flex-col gap-1">
              <label
                htmlFor={idBusca}
                className="text-sm font-medium text-zinc-800"
              >
                Buscar {entidade}
              </label>
              <input
                id={idBusca}
                name="busca"
                type="search"
                defaultValue={busca}
                placeholder={placeholder}
                onChange={(evento) => {
                  if (timerBusca.current) clearTimeout(timerBusca.current);
                  const form = evento.currentTarget.form;
                  if (!form) return;
                  timerBusca.current = setTimeout(
                    () => navegarComFormulario(form),
                    400
                  );
                }}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                {labelTamanho}
                <select
                  name="tamanho"
                  defaultValue={String(tamanho)}
                  onChange={(evento) => {
                    const form = evento.currentTarget.form;
                    if (form) navegarComFormulario(form);
                  }}
                  className="h-11 rounded-lg border border-zinc-300 bg-white px-2 text-base text-zinc-900"
                >
                  {tamanhos.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Buscar
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
        <div onClick={capturarNavegacaoDaLista}>{children}</div>
      )}
    </div>
  );
}

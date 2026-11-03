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
  rota: string;
  busca: string;
  nomeFiltro: string;
  rotuloFiltro: string;
  filtro: string;
  opcoesFiltro: { valor: string; rotulo: string }[];
  tamanho: number;
  ordenacao: string;
  direcao: "asc" | "desc";
  parametrosExtras?: Record<string, string>;
};

const TAMANHOS = [10, 25, 50, 75, 100] as const;

export default function BuscaFiltrosPedidos({
  children,
  resumo,
  rota,
  busca,
  nomeFiltro,
  rotuloFiltro,
  filtro,
  opcoesFiltro,
  tamanho,
  ordenacao,
  direcao,
  parametrosExtras = {},
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
    const campoFiltro = form.elements.namedItem(nomeFiltro);
    if (campoFiltro instanceof HTMLSelectElement) {
      campoFiltro.value = filtro;
    }
    const campoTamanho = form.elements.namedItem("tamanho");
    if (campoTamanho instanceof HTMLSelectElement) {
      campoTamanho.value = String(tamanho);
    }
  }, [busca, filtro, nomeFiltro, tamanho]);

  useEffect(
    () => () => {
      if (timerBusca.current) clearTimeout(timerBusca.current);
    },
    []
  );

  function navegar(url: string) {
    const destino = new URL(url, window.location.origin);
    const caminho = `${destino.pathname}${destino.search}`;
    if (`${window.location.pathname}${window.location.search}` !== caminho) {
      iniciarTransicao(() => router.push(caminho, { scroll: false }));
    }
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
    parametros.set("ordenacao", ordenacao);
    parametros.set("direcao", direcao);
    const query = parametros.toString();
    navegar(query ? `${rota}?${query}` : rota);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    navegarComFormulario(evento.currentTarget);
  }

  function limpar() {
    const form = formulario.current;
    if (!form) return;
    const campoBusca = form.elements.namedItem("busca");
    if (campoBusca instanceof HTMLInputElement) campoBusca.value = "";
    const campoFiltro = form.elements.namedItem(nomeFiltro);
    if (campoFiltro instanceof HTMLSelectElement) campoFiltro.value = "";
    form.querySelectorAll<HTMLInputElement>('input[type="hidden"]').forEach((campo) => {
      if (campo.name !== "ordenacao" && campo.name !== "direcao") {
        campo.value = "";
      }
    });
    navegarComFormulario(form);
  }

  function capturarLinks(evento: MouseEvent<HTMLDivElement>) {
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
    navegar(link.href);
  }

  return (
    <div className="mt-4">
      <details className="group rounded-xl border border-zinc-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
          Busca e Filtros
          <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <form
          ref={formulario}
          action={rota}
          method="get"
          onSubmit={enviar}
          className="grid gap-3 border-t border-zinc-200 p-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <fieldset disabled={pendente} className="contents">
            <input type="hidden" name="ordenacao" value={ordenacao} />
            <input type="hidden" name="direcao" value={direcao} />
            {Object.entries(parametrosExtras).map(([nome, valor]) => (
              <input key={nome} type="hidden" name={nome} value={valor} />
            ))}
            <div className="flex flex-col gap-1">
              <label htmlFor="busca-pedidos" className="text-sm font-medium text-zinc-800">
                Buscar
              </label>
              <input
                id="busca-pedidos"
                name="busca"
                type="search"
                defaultValue={busca}
                onChange={(evento) => {
                  if (timerBusca.current) clearTimeout(timerBusca.current);
                  const form = evento.currentTarget.form;
                  if (form) {
                    timerBusca.current = setTimeout(
                      () => navegarComFormulario(form),
                      400
                    );
                  }
                }}
                className="h-11 w-full rounded-lg border border-zinc-300 px-3 text-base"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filtro-pedidos" className="text-sm font-medium text-zinc-800">
                {rotuloFiltro}
              </label>
              <select
                id="filtro-pedidos"
                name={nomeFiltro}
                defaultValue={filtro}
                onChange={(evento) => {
                  const form = evento.currentTarget.form;
                  if (form) navegarComFormulario(form);
                }}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base"
              >
                {opcoesFiltro.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <label className="flex h-11 items-center gap-2 text-sm text-zinc-800">
                Exibir
                <select
                  name="tamanho"
                  defaultValue={String(tamanho)}
                  onChange={(evento) => {
                    const form = evento.currentTarget.form;
                    if (form) navegarComFormulario(form);
                  }}
                  className="h-11 rounded-lg border border-zinc-300 bg-white px-2 text-base"
                >
                  {TAMANHOS.map((valor) => (
                    <option key={valor} value={valor}>{valor}</option>
                  ))}
                </select>
                por página
              </label>
              <button
                type="submit"
                className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium"
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={limpar}
                className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium"
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
        <div onClickCapture={capturarLinks}>{children}</div>
      )}
    </div>
  );
}

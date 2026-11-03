"use client";

import {
  useEffect,
  useRef,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import CheckboxEnvioAutomatico from "@/components/CheckboxEnvioAutomatico";
import {
  IconeCarregando,
  IconeVisualizacaoCards,
  IconeVisualizacaoTabela,
} from "@/components/icones";

import { TAMANHOS_PAGINA_PRODUTOS } from "./tipos";

type Props = {
  children: ReactNode;
  resumo: ReactNode;
  busca: string;
  mostrarInativos: boolean;
  tamanho: number;
  visualizacao: "cards" | "tabela";
  ordenacao: string;
  direcao: "asc" | "desc";
};

export default function BuscaFiltrosProdutos({
  children,
  resumo,
  busca,
  mostrarInativos,
  tamanho,
  visualizacao,
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
    const campoInativos = form.elements.namedItem("inativos");
    if (campoInativos instanceof HTMLInputElement) {
      campoInativos.checked = mostrarInativos;
    }
    const campoTamanho = form.elements.namedItem("tamanho");
    if (campoTamanho instanceof HTMLSelectElement) {
      campoTamanho.value = String(tamanho);
    }
    const campoVisualizacao = form.elements.namedItem("visualizacao");
    if (campoVisualizacao instanceof HTMLInputElement) {
      campoVisualizacao.value = visualizacao;
    }
    const campoOrdenacao = form.elements.namedItem("ordenacao");
    if (campoOrdenacao instanceof HTMLInputElement) {
      campoOrdenacao.value = ordenacao;
    }
    const campoDirecao = form.elements.namedItem("direcao");
    if (campoDirecao instanceof HTMLInputElement) {
      campoDirecao.value = direcao;
    }
  }, [busca, direcao, mostrarInativos, ordenacao, tamanho, visualizacao]);

  useEffect(
    () => () => {
      if (timerBusca.current) clearTimeout(timerBusca.current);
    },
    []
  );

  function navegarComFormulario(
    form: HTMLFormElement,
    alteracoes: Record<string, string> = {}
  ) {
    if (timerBusca.current) clearTimeout(timerBusca.current);
    const parametros = new URLSearchParams();
    new FormData(form).forEach((valor, chave) => {
      if (typeof valor === "string" && valor !== "") {
        parametros.set(chave, valor);
      }
    });

    parametros.delete("mov");
    parametros.delete("pagina");
    for (const [chave, valor] of Object.entries(alteracoes)) {
      if (valor) parametros.set(chave, valor);
      else parametros.delete(chave);
    }

    const query = parametros.toString();
    const destino = query ? `/produtos?${query}` : "/produtos";
    if (`${window.location.pathname}${window.location.search}` === destino) return;

    iniciarTransicao(() => router.push(destino, { scroll: false }));
  }

  function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (timerBusca.current) clearTimeout(timerBusca.current);
    navegarComFormulario(evento.currentTarget);
  }

  function limparFiltros() {
    const form = formulario.current;
    if (!form) return;

    const campoBusca = form.elements.namedItem("busca");
    if (campoBusca instanceof HTMLInputElement) campoBusca.value = "";
    const inativos = form.elements.namedItem("inativos");
    if (inativos instanceof HTMLInputElement) inativos.checked = false;
    navegarComFormulario(form, { busca: "", inativos: "" });
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
          action="/produtos"
          method="get"
          onSubmit={enviarFormulario}
          className="flex flex-col gap-3 border-t border-zinc-200 p-3"
        >
          <fieldset disabled={pendente} className="contents">
            <input type="hidden" name="visualizacao" value={visualizacao} />
            <input type="hidden" name="ordenacao" value={ordenacao} />
            <input type="hidden" name="direcao" value={direcao} />

            <div className="flex flex-col gap-1">
              <label
                htmlFor="busca"
                className="text-sm font-medium text-zinc-800"
              >
                Buscar produto
              </label>
              <input
                id="busca"
                name="busca"
                type="search"
                defaultValue={busca}
                placeholder="Nome, código de barras ou código do ERP"
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
              <CheckboxEnvioAutomatico
                name="inativos"
                value="1"
                defaultChecked={mostrarInativos}
                label="Mostrar inativos"
                aoNavegar={(destino) => {
                  if (timerBusca.current) clearTimeout(timerBusca.current);
                  iniciarTransicao(() =>
                    router.push(destino, { scroll: false })
                  );
                }}
              />

              <label className="flex items-center gap-2 text-sm text-zinc-800">
                Itens por página
                <select
                  name="tamanho"
                  defaultValue={String(tamanho)}
                  onChange={(evento) => {
                    const form = evento.currentTarget.form;
                    if (form) navegarComFormulario(form);
                  }}
                  className="h-11 rounded-lg border border-zinc-300 bg-white px-2 text-base text-zinc-900"
                >
                  {TAMANHOS_PAGINA_PRODUTOS.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </select>
              </label>

              <div
                role="group"
                aria-label="Modo de visualização dos produtos"
                className="flex items-center gap-1"
              >
                <button
                  type="button"
                  title="Visualização em cards"
                  aria-label="Visualização em cards"
                  aria-pressed={visualizacao === "cards"}
                  disabled={visualizacao === "cards"}
                  onClick={() => {
                    const form = formulario.current;
                    if (form) {
                      navegarComFormulario(form, { visualizacao: "cards" });
                    }
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border ${
                    visualizacao === "cards"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  } disabled:opacity-70`}
                >
                  <IconeVisualizacaoCards className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  title="Visualização em tabela"
                  aria-label="Visualização em tabela"
                  aria-pressed={visualizacao === "tabela"}
                  disabled={visualizacao === "tabela"}
                  onClick={() => {
                    const form = formulario.current;
                    if (form) {
                      navegarComFormulario(form, { visualizacao: "tabela" });
                    }
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border ${
                    visualizacao === "tabela"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  } disabled:opacity-70`}
                >
                  <IconeVisualizacaoTabela className="h-5 w-5" />
                </button>
              </div>

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
          Carregando produtos...
        </div>
      ) : (
        children
      )}
    </div>
  );
}

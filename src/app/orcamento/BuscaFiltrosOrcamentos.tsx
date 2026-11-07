"use client";

import {
  useRef,
  useTransition,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { IconeCarregando } from "@/components/icones";
import type { EstadoEnvioOrcamento } from "./tipos";

type Props = {
  resumo: ReactNode;
  busca: string;
  dataInicio: string;
  dataFim: string;
  statusEmail: EstadoEnvioOrcamento | "";
  statusWhatsApp: EstadoEnvioOrcamento | "";
  tamanho: number;
  ordenacao: string;
  direcao: "asc" | "desc";
  opcoesStatus: { valor: string; rotulo: string }[];
  children: ReactNode;
};

const TAMANHOS_PAGINA = [10, 25, 50, 75, 100] as const;

export default function BuscaFiltrosOrcamentos({
  resumo,
  busca,
  dataInicio,
  dataFim,
  statusEmail,
  statusWhatsApp,
  tamanho,
  ordenacao,
  direcao,
  opcoesStatus,
  children,
}: Props) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function navegar(url: string) {
    const destino = new URL(url, window.location.origin);
    const caminho = `${destino.pathname}${destino.search}`;
    if (`${window.location.pathname}${window.location.search}` !== caminho) {
      iniciarTransicao(() => router.push(caminho, { scroll: false }));
    }
  }

  function navegarComFormulario(
    form: HTMLFormElement,
    incluirBuscaDigitada: boolean
  ) {
    const parametros = new URLSearchParams();
    new FormData(form).forEach((valor, chave) => {
      if (chave !== "busca" && typeof valor === "string" && valor !== "") {
        parametros.set(chave, valor);
      }
    });
    const buscaAplicada = incluirBuscaDigitada
      ? String(new FormData(form).get("busca") ?? "").trim()
      : busca;
    if (buscaAplicada) parametros.set("busca", buscaAplicada);
    parametros.delete("pagina");
    parametros.set("ordenacao", ordenacao);
    parametros.set("direcao", direcao);
    const query = parametros.toString();
    navegar(query ? `/orcamento?${query}` : "/orcamento");
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    navegarComFormulario(evento.currentTarget, true);
  }

  function atualizarFiltro(form: HTMLFormElement | null) {
    if (form) navegarComFormulario(form, false);
  }

  function limpar() {
    navegar("/orcamento");
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
    <>
      <details className="mt-4 rounded-xl border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-base font-semibold text-zinc-900">
          Busca e Filtro
        </summary>
        <form
          ref={formulario}
          action="/orcamento"
          method="get"
          onSubmit={enviar}
          className="grid grid-cols-1 gap-3 border-t border-zinc-200 p-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <fieldset disabled={pendente} className="contents">
            <input type="hidden" name="ordenacao" value={ordenacao} />
            <input type="hidden" name="direcao" value={direcao} />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label
                htmlFor="busca-solicitacoes-orcamento"
                className="text-sm font-medium text-zinc-800"
              >
                Buscar fornecedor, usuário ou ID da solicitação
              </label>
              <input
                key={busca}
                id="busca-solicitacoes-orcamento"
                name="busca"
                type="search"
                defaultValue={busca}
                placeholder="Fornecedor, quem criou ou ID completo"
                className="h-11 w-full rounded-lg border border-zinc-300 px-3 text-base"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="filtro-data-inicio-orcamento"
                className="text-sm font-medium text-zinc-800"
              >
                Data inicial
              </label>
              <input
                id="filtro-data-inicio-orcamento"
                name="dataInicio"
                type="date"
                defaultValue={dataInicio}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="filtro-data-fim-orcamento"
                className="text-sm font-medium text-zinc-800"
              >
                Data final
              </label>
              <input
                id="filtro-data-fim-orcamento"
                name="dataFim"
                type="date"
                defaultValue={dataFim}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="filtro-email-orcamento"
                className="text-sm font-medium text-zinc-800"
              >
                Envio por E-mail
              </label>
              <select
                key={`email-${statusEmail}`}
                id="filtro-email-orcamento"
                name="statusEmail"
                defaultValue={statusEmail}
                onChange={(evento) =>
                  atualizarFiltro(evento.currentTarget.form)
                }
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base"
              >
                {opcoesStatus.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="filtro-whatsapp-orcamento"
                className="text-sm font-medium text-zinc-800"
              >
                Envio por WhatsApp
              </label>
              <select
                key={`whatsapp-${statusWhatsApp}`}
                id="filtro-whatsapp-orcamento"
                name="statusWhatsApp"
                defaultValue={statusWhatsApp}
                onChange={(evento) =>
                  atualizarFiltro(evento.currentTarget.form)
                }
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base"
              >
                {opcoesStatus.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-2">
              <label className="flex h-11 items-center gap-2 text-sm text-zinc-800">
                Exibir
                <select
                  key={tamanho}
                  name="tamanho"
                  defaultValue={String(tamanho)}
                  onChange={(evento) =>
                    atualizarFiltro(evento.currentTarget.form)
                  }
                  className="h-11 rounded-lg border border-zinc-300 bg-white px-2 text-base"
                >
                  {TAMANHOS_PAGINA.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
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
                Limpar filtros
              </button>
            </div>
          </fieldset>
        </form>
      </details>

      {resumo}

      <div
        className="relative mt-3"
        aria-busy={pendente}
        onClick={capturarLinks}
      >
        {children}
        {pendente && (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/75 pt-12">
            <p
              role="status"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
            >
              <IconeCarregando className="h-5 w-5 animate-spin" />
              Carregando...
            </p>
          </div>
        )}
      </div>
    </>
  );
}

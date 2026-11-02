"use client";

import {
  useRef,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { IconeCarregando } from "@/components/icones";

type Props = {
  status: string;
  tamanho: number;
  ordenacao: string;
  direcao: string;
  busca: string;
  dataInicio: string;
  dataFim: string;
  children: ReactNode;
};

const OPCOES_STATUS = [
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "PENDENTES", rotulo: "Pendentes" },
  { valor: "EM_TRANSITO", rotulo: "Em trânsito" },
  { valor: "CONCLUIDOS", rotulo: "Concluídos" },
  { valor: "ABERTOS", rotulo: "Pendentes e Em trânsito" },
] as const;

const TAMANHOS_PAGINA = [10, 25, 50, 75, 100] as const;

export default function ControlesListaTransferencias({
  status,
  tamanho,
  ordenacao,
  direcao,
  busca,
  dataInicio,
  dataFim,
  children,
}: Props) {
  const router = useRouter();
  const [carregando, iniciarTransicao] = useTransition();
  const timerBuscaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function atualizarLista(formulario: HTMLFormElement | null) {
    if (!formulario) return;
    if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);
    const parametros = new URLSearchParams();
    new FormData(formulario).forEach((valor, chave) => {
      if (typeof valor === "string" && valor.trim() !== "") {
        parametros.set(chave, valor.trim());
      }
    });
    parametros.set("pagina", "1");
    iniciarTransicao(() =>
      router.push(`/transferencias?${parametros.toString()}`, { scroll: false })
    );
  }

  function agendarBusca(formulario: HTMLFormElement | null) {
    if (!formulario) return;
    if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);
    timerBuscaRef.current = setTimeout(
      () => atualizarLista(formulario),
      350
    );
  }

  function limparBuscasEFiltros() {
    if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);
    const parametros = new URLSearchParams(window.location.search);
    parametros.delete("busca");
    parametros.delete("dataInicio");
    parametros.delete("dataFim");
    parametros.set("status", "ABERTOS");
    parametros.set("pagina", "1");
    iniciarTransicao(() =>
      router.push(`/transferencias?${parametros.toString()}`, { scroll: false })
    );
  }

  return (
    <>
      <details className="mt-4 rounded-xl border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-base font-semibold text-zinc-900">
          Busca e Filtros
        </summary>
        <form
          action="/transferencias"
          method="get"
          onSubmit={(evento) => {
            evento.preventDefault();
            atualizarLista(evento.currentTarget);
          }}
          className="grid grid-cols-1 gap-3 border-t border-zinc-200 p-3 sm:grid-cols-2 lg:grid-cols-5"
        >
        <input type="hidden" name="ordenacao" value={ordenacao} />
        <input type="hidden" name="direcao" value={direcao} />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-status-transferencia"
            className="text-sm font-medium text-zinc-800"
          >
            Exibir Status
          </label>
          <select
            key={status}
            id="filtro-status-transferencia"
            name="status"
            defaultValue={status}
            onChange={(evento) => atualizarLista(evento.currentTarget.form)}
            aria-busy={carregando}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
          >
            {OPCOES_STATUS.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="tamanho-transferencias"
            className="text-sm font-medium text-zinc-800"
          >
            Resultados por página
          </label>
          <select
            id="tamanho-transferencias"
            name="tamanho"
            key={tamanho}
            defaultValue={tamanho}
            onChange={(evento) => atualizarLista(evento.currentTarget.form)}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
          >
            {TAMANHOS_PAGINA.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <label
            htmlFor="busca-transferencias"
            className="text-sm font-medium text-zinc-800"
          >
            Nome do solicitante, remetente ou recebedor
          </label>
          <input
            id="busca-transferencias"
            name="busca"
            type="search"
            key={busca}
            defaultValue={busca}
            placeholder="Solicitante, remetente ou recebedor"
            onChange={(evento) => agendarBusca(evento.currentTarget.form)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                atualizarLista(evento.currentTarget.form);
              }
            }}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="data-inicio-transferencias"
            className="text-sm font-medium text-zinc-800"
          >
            Data inicial
          </label>
          <input
            id="data-inicio-transferencias"
            name="dataInicio"
            type="date"
            key={dataInicio}
            defaultValue={dataInicio}
            onChange={(evento) => atualizarLista(evento.currentTarget.form)}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="data-fim-transferencias"
            className="text-sm font-medium text-zinc-800"
          >
            Data final
          </label>
          <input
            id="data-fim-transferencias"
            name="dataFim"
            type="date"
            key={dataFim}
            defaultValue={dataFim}
            onChange={(evento) => atualizarLista(evento.currentTarget.form)}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-5">
          <button
            type="button"
            onClick={limparBuscasEFiltros}
            disabled={carregando}
            className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Limpar buscas e filtros
          </button>
        </div>
        </form>
      </details>

      <div
        className="relative"
        aria-busy={carregando}
        aria-describedby={
          carregando ? "carregando-lista-transferencias" : undefined
        }
      >
        {children}
        {carregando && (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/70 pt-16">
            <p
              id="carregando-lista-transferencias"
              role="status"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
            >
              <IconeCarregando className="h-5 w-5 animate-spin" />
              Carregando pedidos...
            </p>
          </div>
        )}
      </div>
    </>
  );
}

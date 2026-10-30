"use client";

// ============================================================
// Módulo 1 - Movimentação de estoque (componente de cliente)
// Mostra os botões Entrada, Saída e Contagem. Cada um abre um
// popup (o mesmo, mudando só o título) com um campo por local de
// estoque, para o usuário informar a quantidade movimentada.
// Regras: docs/regras-de-negocio.md (RN-02)
// ============================================================

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  IconeClipboardCheck,
  IconeEntrada,
  IconeSaida,
} from "@/components/icones";
import { registrarMovimento } from "./actions";
import {
  ESTADO_MOVIMENTO_VAZIO,
  PREFIXO_QUANTIDADE,
  ROTULO_MOVIMENTO,
  TIPOS_MOVIMENTO,
  type EstadoMovimento,
  type LocalDeEstoque,
  type TipoMovimento,
} from "./tipos";

type Props = {
  produtoId: number;
  locais: LocalDeEstoque[];
  // Estoque atual de cada local já formatado (ex.: "1,5"); chave = id do local
  saldos: Record<string, string>;
  // Para onde ir depois de registrar. Quando vazio, a ação volta
  // para a tela de edição do produto.
  retorno?: string;
  // "bloco" = título e botões horizontais (padrão);
  // "lateral" = apenas os 3 ícones em coluna (usado na lista)
  // "horizontal" = apenas os 3 ícones em linha (novo layout da lista)
  layout?: "bloco" | "lateral" | "horizontal";
};

// Campos altos (48px) e com fonte de 16px: uso em pé, no celular
const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";

// Texto de ajuda muda conforme o tipo de movimentação
const AJUDA: Record<TipoMovimento, string> = {
  ENTRADA:
    "Informe quanto entrou em cada local. A quantidade é somada ao estoque atual. Deixe em branco o local que não teve entrada.",
  SAIDA:
    "Informe quanto saiu de cada local. A quantidade é subtraída do estoque atual. Deixe em branco o local que não teve saída.",
  CONTAGEM:
    "Informe a quantidade contada em cada local. O valor substitui o estoque atual. Deixe em branco o local que não foi contado.",
};

export default function MovimentacaoEstoque({
  produtoId,
  locais,
  saldos,
  retorno,
  layout = "bloco",
}: Props) {
  const [tipoAberto, setTipoAberto] = useState<TipoMovimento | null>(null);

  if (locais.length === 0) {
    if (layout === "lateral") return null;
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        <p className="text-base text-zinc-700">
          Nenhum local de estoque cadastrado.{" "}
          <Link href="/locais" className="underline">
            Cadastrar locais de estoque
          </Link>{" "}
          para poder movimentar o estoque.
        </p>
      </div>
    );
  }

  if (layout === "lateral" || layout === "horizontal") {
    return (
      <>
        <div
          className={`flex ${
            layout === "lateral" ? "flex-col" : "flex-row"
          } gap-3`}
        >
          <button
            type="button"
            title="Entrada de estoque"
            onClick={() => setTipoAberto("ENTRADA")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#22c55e]/10 bg-[#eefcf4] text-[#22c55e] shadow-sm transition-colors hover:bg-[#dcfce7]"
          >
            <IconeEntrada className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Saída de estoque"
            onClick={() => setTipoAberto("SAIDA")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#ef4444]/10 bg-[#fff5f5] text-[#ef4444] shadow-sm transition-colors hover:bg-[#fee2e2]"
          >
            <IconeSaida className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Contagem de estoque"
            onClick={() => setTipoAberto("CONTAGEM")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#6366f1]/10 bg-[#f5f5ff] text-[#6366f1] shadow-sm transition-colors hover:bg-[#e0e7ff]"
          >
            <IconeClipboardCheck className="h-5 w-5" />
          </button>
        </div>

        {tipoAberto && (
          <PopupMovimento
            key={tipoAberto}
            tipo={tipoAberto}
            produtoId={produtoId}
            locais={locais}
            saldos={saldos}
            retorno={retorno}
            aoFechar={() => setTipoAberto(null)}
          />
        )}
      </>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3">
      <h2 className="text-base font-semibold text-zinc-900">
        Movimentar estoque
      </h2>

      <div className="mt-3 flex flex-wrap gap-3">
        {TIPOS_MOVIMENTO.map((tipo) => (
          <button
            key={tipo}
            type="button"
            onClick={() => setTipoAberto(tipo)}
            className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
          >
            {ROTULO_MOVIMENTO[tipo]}
          </button>
        ))}
      </div>

      {tipoAberto && (
        // A chave remonta o formulário ao trocar de tipo, zerando erros
        <PopupMovimento
          key={tipoAberto}
          tipo={tipoAberto}
          produtoId={produtoId}
          locais={locais}
          saldos={saldos}
          retorno={retorno}
          aoFechar={() => setTipoAberto(null)}
        />
      )}
    </section>
  );
}

type PropsPopup = {
  tipo: TipoMovimento;
  produtoId: number;
  locais: LocalDeEstoque[];
  saldos: Record<string, string>;
  retorno?: string;
  aoFechar: () => void;
};

function PopupMovimento({
  tipo,
  produtoId,
  locais,
  saldos,
  retorno,
  aoFechar,
}: PropsPopup) {
  const [estado, enviarFormulario, enviando] = useActionState<
    EstadoMovimento,
    FormData
  >(registrarMovimento, ESTADO_MOVIMENTO_VAZIO);

  // Na contagem o campo já vem com o estoque atual; na entrada e na
  // saída, começa vazio. Se houve erro, mantém o que o usuário digitou.
  function valorInicial(chave: string): string {
    const digitado = estado.valores[chave];
    if (digitado !== undefined) return digitado;
    return tipo === "CONTAGEM" ? saldos[chave] ?? "" : "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ROTULO_MOVIMENTO[tipo]}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-zinc-900">
            {ROTULO_MOVIMENTO[tipo]}
          </h3>
          <button
            type="button"
            onClick={aoFechar}
            className="h-11 rounded-lg border border-zinc-300 px-3 text-base font-medium text-zinc-900"
          >
            Fechar
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-500">{AJUDA[tipo]}</p>

        <form action={enviarFormulario} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="produtoId" value={produtoId} />
          <input type="hidden" name="tipo" value={tipo} />
          {retorno && <input type="hidden" name="retorno" value={retorno} />}

          {estado.erroGeral && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-base text-red-700"
            >
              {estado.erroGeral}
            </p>
          )}

          {locais.map((local) => {
            const chave = String(local.id);
            const erro = estado.erros?.[chave];

            return (
              <div key={local.id} className="flex flex-col gap-1">
                <label
                  htmlFor={`${PREFIXO_QUANTIDADE}${local.id}`}
                  className="text-base font-medium text-zinc-800"
                >
                  {local.nome}
                </label>
                <input
                  id={`${PREFIXO_QUANTIDADE}${local.id}`}
                  name={`${PREFIXO_QUANTIDADE}${local.id}`}
                  type="text"
                  inputMode="decimal"
                  defaultValue={valorInicial(chave)}
                  aria-invalid={erro ? true : undefined}
                  placeholder="0"
                  className={CLASSE_CAMPO}
                />
                <p className="text-sm text-zinc-500">
                  Estoque atual: {saldos[chave] ?? "0"}
                </p>
                {erro && <p className="text-sm text-red-700">{erro}</p>}
              </div>
            );
          })}

          <div className="mt-1 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={enviando}
              className="h-12 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:opacity-60"
            >
              {enviando ? "Salvando..." : ROTULO_MOVIMENTO[tipo]}
            </button>
            <button
              type="button"
              onClick={aoFechar}
              className="h-12 rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

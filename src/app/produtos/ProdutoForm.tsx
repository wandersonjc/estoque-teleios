"use client";

// ============================================================
// Módulo 1 - Cadastro de produtos: formulário (componente de cliente)
// É o mesmo formulário para cadastrar e para editar; o que muda é a
// ação do servidor e os valores iniciais.
// ============================================================

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import BotaoAcao from "@/components/BotaoAcao";
import CampoImagem from "@/components/CampoImagem";
import { IconeInterrogacao } from "@/components/icones";

import {
  LIMITE_CODIGO_ERP,
  LIMITE_NOME,
  UNIDADES,
  VALORES_FORMULARIO_VAZIOS,
  type EstadoFormularioProduto,
  type ValoresFormularioProduto,
} from "./tipos";

type Props = {
  // Ação do servidor que grava (criarProduto ou atualizarProduto)
  acao: (
    estadoAnterior: EstadoFormularioProduto,
    formData: FormData
  ) => Promise<EstadoFormularioProduto>;
  textoBotao: string;
  // Preenchido apenas na edição
  id?: number;
  valoresIniciais?: ValoresFormularioProduto;
  imagemUrl?: string;
  acaoStatus?: (formData: FormData) => Promise<void>;
  textoAcaoStatus?: string;
  acaoExclusao?: (formData: FormData) => Promise<void>;
  confirmacaoExclusao?: string;
};

// Campos altos (48px) e com fonte de 16px: uso em pé, no celular
const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";
const CLASSE_ROTULO = "text-base font-medium text-zinc-800";

function DicaUnidadeBase() {
  const [aberta, setAberta] = useState(false);
  const id = useId();

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="O que significa Unidade de estoque base?"
        aria-describedby={aberta ? id : undefined}
        aria-expanded={aberta}
        title="Explicação sobre a unidade-base"
        onClick={() => setAberta((anterior) => !anterior)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-[#002855] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002855]"
      >
        <IconeInterrogacao className="h-4 w-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-left text-xs font-medium leading-relaxed text-white shadow-lg transition-opacity ${
          aberta
            ? "opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        }`}
      >
        É a forma como o Átria conta o estoque. Escolha, normalmente, a menor
        unidade que pode ser vendida separadamente. Por exemplo: se o produto é
        vendido avulso e também em caixas com 100 unidades, escolha UN como
        unidade-base e cadastre a caixa como CX, equivalente a 100 UN. Assim,
        uma entrada de 1 caixa soma 100 UN ao estoque. O saldo e as contagens
        usam sempre a unidade-base. Ela fica fixa após o cadastro
        para não mudar o significado dos saldos e do histórico já registrados.
      </span>
    </span>
  );
}

export default function ProdutoForm({
  acao,
  textoBotao,
  id,
  valoresIniciais,
  imagemUrl,
  acaoStatus,
  textoAcaoStatus,
  acaoExclusao,
  confirmacaoExclusao,
}: Props) {
  // useActionState guarda o que foi digitado e os erros devolvidos
  // pelo servidor, então o formulário não perde o conteúdo.
  const [estado, enviarFormulario, salvando] = useActionState(acao, {
    valores: valoresIniciais ?? VALORES_FORMULARIO_VAZIOS,
  });

  const valores = estado.valores;
  const erros = estado.erros ?? {};

  return (
    <form action={enviarFormulario} className="flex flex-col gap-4">
      {/* O id só existe na edição */}
      {id !== undefined && <input type="hidden" name="id" value={id} />}

      {estado.erroGeral && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-700">
          {estado.erroGeral}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 md:border-r md:border-zinc-200 md:pr-4">
          <CampoImagem imagemUrl={imagemUrl} textoAlternativo="Imagem do produto" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <label htmlFor="unidade" className={CLASSE_ROTULO}>
                Unidade de estoque (base)
              </label>
              <DicaUnidadeBase />
            </div>
            {id === undefined ? (
              <>
                <select
                  id="unidade"
                  name="unidade"
                  required
                  defaultValue={valores.unidade}
                  aria-invalid={erros.unidade ? true : undefined}
                  className={CLASSE_CAMPO}
                >
                  {UNIDADES.map((unidade) => (
                    <option key={unidade} value={unidade}>
                      {unidade}
                    </option>
                  ))}
                </select>
                {erros.unidade && (
                  <p className="text-sm text-red-700">{erros.unidade}</p>
                )}
              </>
            ) : (
              <p className="flex h-12 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-700">
                {valores.unidade}
              </p>
            )}
            <p className="text-sm text-zinc-500">
              Unidade usada nos saldos e nas contagens. Não pode ser alterada
              após criar o produto.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:pl-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="codigoErp" className={CLASSE_ROTULO}>
              Código do ERP
            </label>
            <input
              id="codigoErp"
              name="codigoErp"
              type="text"
              maxLength={LIMITE_CODIGO_ERP}
              defaultValue={valores.codigoErp}
              aria-invalid={erros.codigoErp ? true : undefined}
              placeholder="Opcional (único)"
              className={CLASSE_CAMPO}
            />
            <p className="text-sm text-zinc-500">
              Código do produto no Superus. É a chave da importação de planilha.
            </p>
            {erros.codigoErp && (
              <p className="text-sm text-red-700">{erros.codigoErp}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="nome" className={CLASSE_ROTULO}>
              Nome <span className="text-red-700">*</span>
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              maxLength={LIMITE_NOME}
              defaultValue={valores.nome}
              aria-invalid={erros.nome ? true : undefined}
              placeholder="Ex.: Copo descartável 200 ml"
              className={CLASSE_CAMPO}
            />
            {erros.nome && <p className="text-sm text-red-700">{erros.nome}</p>}
          </div>

        </div>
      </div>

      {/* O estoque NÃO fica aqui: ele é informado na tela do produto,
          pelos popups de entrada, saída e contagem (RN-02) */}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={salvando}
          className="h-12 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:opacity-60"
        >
          {salvando ? "Salvando..." : textoBotao}
        </button>
        <Link
          href="/produtos"
          className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
        >
          Cancelar
        </Link>
        {acaoStatus && textoAcaoStatus && (
          <BotaoAcao
            formAction={acaoStatus}
            className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
          >
            {textoAcaoStatus}
          </BotaoAcao>
        )}
        {acaoExclusao && (
          <BotaoAcao
            formAction={acaoExclusao}
            confirmacao={confirmacaoExclusao}
            className="h-12 rounded-lg border border-red-300 px-4 text-base font-medium text-red-700 hover:bg-red-50"
          >
            Excluir produto
          </BotaoAcao>
        )}
      </div>
    </form>
  );
}

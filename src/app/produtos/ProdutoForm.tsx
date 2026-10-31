"use client";

// ============================================================
// Módulo 1 - Cadastro de produtos: formulário (componente de cliente)
// É o mesmo formulário para cadastrar e para editar; o que muda é a
// ação do servidor e os valores iniciais.
// ============================================================

import Link from "next/link";
import { useActionState } from "react";
import CampoImagem from "@/components/CampoImagem";

import {
  LIMITE_CODIGO_BARRAS,
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
};

// Campos altos (48px) e com fonte de 16px: uso em pé, no celular
const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";
const CLASSE_ROTULO = "text-base font-medium text-zinc-800";

export default function ProdutoForm({
  acao,
  textoBotao,
  id,
  valoresIniciais,
  imagemUrl,
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

      <CampoImagem imagemUrl={imagemUrl} textoAlternativo="Imagem do produto" />

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

      <div className="flex flex-col gap-1">
        <label htmlFor="unidade" className={CLASSE_ROTULO}>
          Unidade <span className="text-red-700">*</span>
        </label>
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
        {erros.unidade && <p className="text-sm text-red-700">{erros.unidade}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="estoqueMinimo" className={CLASSE_ROTULO}>
          Estoque mínimo
        </label>
        <input
          id="estoqueMinimo"
          name="estoqueMinimo"
          type="text"
          inputMode="decimal"
          defaultValue={valores.estoqueMinimo}
          aria-invalid={erros.estoqueMinimo ? true : undefined}
          placeholder="0"
          className={CLASSE_CAMPO}
        />
        <p className="text-sm text-zinc-500">
          Comparado com o total dos 3 locais. Use vírgula para decimais (ex.: 1,5).
        </p>
        {erros.estoqueMinimo && (
          <p className="text-sm text-red-700">{erros.estoqueMinimo}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="codigoBarras" className={CLASSE_ROTULO}>
          Código de barras
        </label>
        <input
          id="codigoBarras"
          name="codigoBarras"
          type="text"
          inputMode="numeric"
          maxLength={LIMITE_CODIGO_BARRAS}
          defaultValue={valores.codigoBarras}
          aria-invalid={erros.codigoBarras ? true : undefined}
          placeholder="Opcional"
          className={CLASSE_CAMPO}
        />
        {erros.codigoBarras && (
          <p className="text-sm text-red-700">{erros.codigoBarras}</p>
        )}
      </div>

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
      </div>
    </form>
  );
}

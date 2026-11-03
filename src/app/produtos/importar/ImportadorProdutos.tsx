"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { IconeCarregando } from "@/components/icones";

import { analisarArquivo, importarProdutos } from "./actions";
import type {
  ResultadoAnaliseImportacao,
  ResultadoImportacao,
} from "./tipos";

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";

export default function ImportadorProdutos() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<ResultadoAnaliseImportacao | null>(null);
  const [codigoColuna, setCodigoColuna] = useState("");
  const [nomeColuna, setNomeColuna] = useState("");
  const [linhaInicial, setLinhaInicial] = useState("");
  const [resultadoImportacao, setResultadoImportacao] =
    useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, iniciarTransicao] = useTransition();

  const analiseValida = analise?.ok === true;
  const preVisualizacaoAtualizada =
    analiseValida &&
    codigoColuna === String(analise.codigoColuna) &&
    nomeColuna === String(analise.nomeColuna) &&
    linhaInicial === String(analise.linhaInicial);
  const podeImportar =
    preVisualizacaoAtualizada &&
    analiseValida &&
    analise.linhasValidas > 0 &&
    analise.linhasComErro === 0;

  function analisar() {
    if (!arquivo) {
      setErro("Selecione um arquivo para continuar.");
      return;
    }

    const dados = new FormData();
    dados.set("arquivo", arquivo);
    if (codigoColuna) dados.set("codigoColuna", codigoColuna);
    if (nomeColuna) dados.set("nomeColuna", nomeColuna);
    if (linhaInicial) dados.set("linhaInicial", linhaInicial);

    setErro("");
    setResultadoImportacao(null);
    iniciarTransicao(async () => {
      const resultado = await analisarArquivo(dados);
      setAnalise(resultado);
      if (resultado.ok) {
        setCodigoColuna(String(resultado.codigoColuna));
        setNomeColuna(String(resultado.nomeColuna));
        setLinhaInicial(String(resultado.linhaInicial));
      } else {
        setErro(resultado.erro);
      }
    });
  }

  function importar() {
    if (!arquivo || !podeImportar) return;
    if (
      !window.confirm(
        "Importar os produtos desta prévia? Códigos já cadastrados terão somente o nome atualizado."
      )
    ) {
      return;
    }

    const dados = new FormData();
    dados.set("arquivo", arquivo);
    dados.set("codigoColuna", codigoColuna);
    dados.set("nomeColuna", nomeColuna);
    dados.set("linhaInicial", linhaInicial);

    setErro("");
    iniciarTransicao(async () => {
      const resultado = await importarProdutos(dados);
      setResultadoImportacao(resultado);
      if (!resultado.ok) setErro(resultado.erro);
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900">
          Selecione a planilha
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Envie um arquivo .xls, .xlsx ou .csv de até 5 MB. A primeira aba
          visível será analisada. O sistema procura código ERP e nome mesmo que
          as colunas estejam deslocadas ou tenham títulos diferentes.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label
              htmlFor="arquivo-produtos"
              className="text-sm font-medium text-zinc-800"
            >
              Arquivo
            </label>
            <input
              id="arquivo-produtos"
              type="file"
              accept=".xls,.xlsx,.csv"
              disabled={ocupado}
              onChange={(evento) => {
                setArquivo(evento.currentTarget.files?.[0] ?? null);
                setAnalise(null);
                setResultadoImportacao(null);
                setErro("");
                setCodigoColuna("");
                setNomeColuna("");
                setLinhaInicial("");
              }}
              className="min-h-12 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-800 file:mr-3 file:h-8 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:text-sm file:font-medium file:text-zinc-800"
            />
          </div>
          <button
            type="button"
            onClick={analisar}
            disabled={!arquivo || ocupado}
            className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#002855] px-4 text-base font-medium text-white hover:bg-[#124b7e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ocupado && <IconeCarregando className="h-5 w-5 animate-spin" />}
            Analisar arquivo
          </button>
        </div>
      </section>

      {erro && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {erro}
        </p>
      )}

      {analiseValida && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Confira o mapeamento e a prévia
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Arquivo: {analise.arquivo} · Aba: {analise.planilha}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="coluna-codigo"
                className="text-sm font-medium text-zinc-800"
              >
                Coluna do código ERP
              </label>
              <select
                id="coluna-codigo"
                value={codigoColuna}
                onChange={(evento) => setCodigoColuna(evento.target.value)}
                disabled={ocupado}
                className={CLASSE_CAMPO}
              >
                {analise.colunas.map((coluna) => (
                  <option key={coluna.indice} value={coluna.indice}>
                    {coluna.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="coluna-nome"
                className="text-sm font-medium text-zinc-800"
              >
                Coluna do nome do produto
              </label>
              <select
                id="coluna-nome"
                value={nomeColuna}
                onChange={(evento) => setNomeColuna(evento.target.value)}
                disabled={ocupado}
                className={CLASSE_CAMPO}
              >
                {analise.colunas.map((coluna) => (
                  <option key={coluna.indice} value={coluna.indice}>
                    {coluna.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="linha-inicial"
                className="text-sm font-medium text-zinc-800"
              >
                Primeira linha de produtos
              </label>
              <input
                id="linha-inicial"
                type="number"
                min={1}
                max={10_000}
                value={linhaInicial}
                onChange={(evento) => setLinhaInicial(evento.target.value)}
                disabled={ocupado}
                className={CLASSE_CAMPO}
              />
            </div>
          </div>

          {!preVisualizacaoAtualizada && (
            <p className="mt-3 text-sm text-amber-800" role="status">
              O mapeamento mudou. Atualize a prévia antes de importar.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-700">
              {analise.linhasValidas} linha(s) válida(s)
              {analise.linhasComErro > 0 &&
                ` · ${analise.linhasComErro} linha(s) com erro`}
            </p>
            <button
              type="button"
              onClick={analisar}
              disabled={!arquivo || ocupado}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ocupado && <IconeCarregando className="h-4 w-4 animate-spin" />}
              Atualizar prévia
            </button>
          </div>

          {analise.erros.length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">
                Corrija os erros antes de importar:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {analise.erros.map((mensagem) => (
                  <li key={mensagem}>{mensagem}</li>
                ))}
                {analise.linhasComErro > analise.erros.length && (
                  <li>
                    e mais {analise.linhasComErro - analise.erros.length} erro(s).
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Linha
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Código ERP
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Nome do produto
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {analise.amostra.length > 0 ? (
                  analise.amostra.map((linha) => (
                    <tr key={linha.linha}>
                      <td className="px-3 py-2 text-zinc-600">{linha.linha}</td>
                      <td className="px-3 py-2 text-zinc-900">{linha.codigoErp}</td>
                      <td className="px-3 py-2 text-zinc-900">{linha.nome}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-zinc-600">
                      Nenhuma linha válida na seleção atual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Produtos novos serão cadastrados com unidade UN e estoque inicial
            zerado. Se o código ERP já existir, somente o nome
            será atualizado. Unidades, códigos de barras, estoques e demais
            dados existentes serão preservados.
          </p>

          <button
            type="button"
            onClick={importar}
            disabled={!podeImportar || ocupado}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#002855] px-4 text-base font-medium text-white hover:bg-[#124b7e] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {ocupado && <IconeCarregando className="h-5 w-5 animate-spin" />}
            Importar produtos
          </button>
        </section>
      )}

      {resultadoImportacao?.ok && (
        <section
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"
        >
          <p className="font-semibold">Importação concluída.</p>
          <p className="mt-1">
            {resultadoImportacao.criados} criado(s),{" "}
            {resultadoImportacao.atualizados} atualizado(s) e{" "}
            {resultadoImportacao.semAlteracao} sem alteração.
          </p>
        </section>
      )}

      <div>
        <Link href="/produtos" className="text-sm font-medium text-[#002855]">
          Voltar para produtos
        </Link>
      </div>
    </div>
  );
}

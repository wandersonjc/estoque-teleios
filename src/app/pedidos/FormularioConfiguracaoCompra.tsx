"use client";

import { useActionState } from "react";

import BotaoAcao from "@/components/BotaoAcao";

import { salvarConfiguracaoCompra } from "./actions";
import type {
  EstadoConfiguracaoCompra,
  ValoresConfiguracaoCompra,
} from "./tipos";

type UnidadeEntrada = {
  valor: string;
  rotulo: string;
};

const ESTADO_INICIAL: EstadoConfiguracaoCompra = {
  valores: {
    produtoId: "",
    consumoInformado: "",
    unidadeConsumo: "BASE",
    periodoConsumo: "MES",
    estoqueSeguranca: "",
    unidadeEstoqueSeguranca: "BASE",
    estoqueMaximoDesejado: "",
    unidadeEstoqueMaximo: "BASE",
  },
};

const CLASSE_CAMPO =
  "h-12 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900";
const CLASSE_ROTULO = "text-sm font-medium text-zinc-800";

function CampoComUnidade({
  id,
  nome,
  rotulo,
  unidadeNome,
  valor,
  unidadeValor,
  unidades,
}: {
  id: string;
  nome: string;
  rotulo: string;
  unidadeNome: string;
  valor: string;
  unidadeValor: string;
  unidades: UnidadeEntrada[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={CLASSE_ROTULO}>
        {rotulo}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.8fr)] gap-2">
        <input
          id={id}
          name={nome}
          type="text"
          inputMode="decimal"
          required
          defaultValue={valor}
          className={CLASSE_CAMPO}
        />
        <select
          name={unidadeNome}
          aria-label={`Unidade para ${rotulo.toLowerCase()}`}
          defaultValue={unidadeValor}
          required
          className={CLASSE_CAMPO}
        >
          {unidades.map((unidade) => (
            <option key={unidade.valor} value={unidade.valor}>
              {unidade.rotulo}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function FormularioConfiguracaoCompra({
  produtoId,
  valoresIniciais,
  unidades,
}: {
  produtoId: number;
  valoresIniciais: Omit<ValoresConfiguracaoCompra, "produtoId">;
  unidades: {
    consumo: UnidadeEntrada[];
    seguranca: UnidadeEntrada[];
    maximo: UnidadeEntrada[];
  };
}) {
  const [estado, salvar] = useActionState(salvarConfiguracaoCompra, {
    ...ESTADO_INICIAL,
    valores: { ...valoresIniciais, produtoId: String(produtoId) },
  });
  const valores = estado.valores;

  return (
    <form
      key={JSON.stringify(valores)}
      action={salvar}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="produtoId" value={produtoId} />

      {estado.erroGeral && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {estado.erroGeral}
        </p>
      )}
      {estado.sucesso && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {estado.sucesso}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoComUnidade
          id="consumoInformado"
          nome="consumoInformado"
          rotulo="Consumo médio informado"
          unidadeNome="unidadeConsumo"
          valor={valores.consumoInformado}
          unidadeValor={valores.unidadeConsumo}
          unidades={unidades.consumo}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="periodoConsumo" className={CLASSE_ROTULO}>
            Período do consumo
          </label>
          <select
            id="periodoConsumo"
            name="periodoConsumo"
            defaultValue={valores.periodoConsumo}
            required
            className={CLASSE_CAMPO}
          >
            <option value="" disabled>
              Selecione
            </option>
            <option value="DIA">Dia</option>
            <option value="SEMANA">Semana</option>
            <option value="MES">Mês (30 dias)</option>
          </select>
        </div>
        <CampoComUnidade
          id="estoqueSeguranca"
          nome="estoqueSeguranca"
          rotulo="Estoque de segurança"
          unidadeNome="unidadeEstoqueSeguranca"
          valor={valores.estoqueSeguranca}
          unidadeValor={valores.unidadeEstoqueSeguranca}
          unidades={unidades.seguranca}
        />
        <CampoComUnidade
          id="estoqueMaximoDesejado"
          nome="estoqueMaximoDesejado"
          rotulo="Estoque máximo desejado"
          unidadeNome="unidadeEstoqueMaximo"
          valor={valores.estoqueMaximoDesejado}
          unidadeValor={valores.unidadeEstoqueMaximo}
          unidades={unidades.maximo}
        />
      </div>

      <p className="text-sm text-zinc-600">
        Os valores são convertidos automaticamente para{" "}
        {unidades.consumo[0]?.rotulo}
        {" "}antes dos cálculos. Consumo semanal é dividido por 7 e mensal por
        30 dias. A equivalência da embalagem é registrada com a configuração.
      </p>
      <BotaoAcao className="h-12 w-full rounded-lg bg-zinc-900 px-4 text-base font-medium text-white sm:w-auto">
        Salvar parâmetros de reposição
      </BotaoAcao>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import BotaoAcao from "@/components/BotaoAcao";

import { salvarConfiguracaoCompra } from "./actions";
import type {
  EstadoConfiguracaoCompra,
  ValoresConfiguracaoCompra,
} from "./tipos";

const ESTADO_INICIAL: EstadoConfiguracaoCompra = {
  valores: {
    produtoId: "",
    consumoInformado: "",
    periodoConsumo: "MES",
    estoqueSeguranca: "",
    estoqueMaximoDesejado: "",
  },
};

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900";
const CLASSE_ROTULO = "text-sm font-medium text-zinc-800";

export default function FormularioConfiguracaoCompra({
  produtoId,
  valoresIniciais,
}: {
  produtoId: number;
  valoresIniciais: Omit<ValoresConfiguracaoCompra, "produtoId">;
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
        <div className="flex flex-col gap-1">
          <label htmlFor="consumoInformado" className={CLASSE_ROTULO}>
            Consumo informado (unidade-base)
          </label>
          <input
            id="consumoInformado"
            name="consumoInformado"
            type="text"
            inputMode="decimal"
            required
            defaultValue={valores.consumoInformado}
            className={CLASSE_CAMPO}
          />
        </div>
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
        <div className="flex flex-col gap-1">
          <label htmlFor="estoqueSeguranca" className={CLASSE_ROTULO}>
            Estoque de segurança
          </label>
          <input
            id="estoqueSeguranca"
            name="estoqueSeguranca"
            type="text"
            inputMode="decimal"
            required
            defaultValue={valores.estoqueSeguranca}
            className={CLASSE_CAMPO}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="estoqueMaximoDesejado" className={CLASSE_ROTULO}>
            Estoque máximo desejado
          </label>
          <input
            id="estoqueMaximoDesejado"
            name="estoqueMaximoDesejado"
            type="text"
            inputMode="decimal"
            required
            defaultValue={valores.estoqueMaximoDesejado}
            className={CLASSE_CAMPO}
          />
        </div>
      </div>

      <p className="text-sm text-zinc-600">
        Quantidades na unidade-base do produto, com até 3 casas decimais.
        Consumo semanal é dividido por 7 e mensal por 30.
      </p>
      <BotaoAcao className="h-12 w-full rounded-lg bg-zinc-900 px-4 text-base font-medium text-white sm:w-auto">
        Salvar parâmetros de reposição
      </BotaoAcao>
    </form>
  );
}

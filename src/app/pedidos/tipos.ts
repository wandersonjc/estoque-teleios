import { Prisma } from "@/generated/prisma/client";
import { normalizarDecimal } from "@/app/produtos/tipos";

export type PeriodoConsumoTela = "DIA" | "SEMANA" | "MES";

export const DIAS_POR_PERIODO: Record<PeriodoConsumoTela, number> = {
  DIA: 1,
  SEMANA: 7,
  MES: 30,
};

export type ValoresConfiguracaoCompra = {
  produtoId: string;
  consumoInformado: string;
  periodoConsumo: PeriodoConsumoTela | "";
  estoqueSeguranca: string;
  estoqueMaximoDesejado: string;
};

export type EstadoConfiguracaoCompra = {
  erroGeral?: string;
  sucesso?: string;
  valores: ValoresConfiguracaoCompra;
};

export function normalizarQuantidadeCompra(valorOriginal: string): string | null {
  if (valorOriginal.trim() === "") return null;
  const valor = normalizarDecimal(valorOriginal);
  if (
    valor === null ||
    !/^\d{1,9}(\.\d{1,3})?$/.test(valor)
  ) {
    return null;
  }
  return new Prisma.Decimal(valor).toFixed(3);
}

export function calcularConsumoDiario(
  consumoInformado: string,
  periodo: PeriodoConsumoTela
): string {
  return new Prisma.Decimal(consumoInformado)
    .div(DIAS_POR_PERIODO[periodo])
    .toDecimalPlaces(3)
    .toFixed(3);
}

export function rotuloPeriodoConsumo(periodo: PeriodoConsumoTela): string {
  switch (periodo) {
    case "DIA":
      return "dia";
    case "SEMANA":
      return "semana";
    case "MES":
      return "mês";
  }
}

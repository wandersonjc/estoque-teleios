export function numeroDeEntrada(valor: string): number | null {
  const texto = valor.replace(/\s/g, "");
  if (!texto) return null;
  if (!/^[\d.,]+$/.test(texto)) return null;

  let normalizado: string;
  if (texto.includes(",")) {
    if ((texto.match(/,/g) ?? []).length > 1) return null;
    normalizado = texto.replace(/\./g, "").replace(",", ".");
  } else if ((texto.match(/\./g) ?? []).length > 1) {
    normalizado = texto.replace(/\./g, "");
  } else {
    normalizado = texto;
  }
  normalizado = normalizado.replace(/\.$/, "");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export function valorDeEntrada(valor: number, casas: number): string {
  return valor.toFixed(casas).replace(".", ",");
}

export function converterEntradaUnidade(
  quantidade: string,
  preco: string,
  fatorAtual: string,
  fatorNovo: string
): { quantidade: string; preco: string; ajustePrecoNecessario: boolean } | null {
  let quantidadeConvertida = quantidade;
  const quantidadeNumerica = numeroDeEntrada(quantidade);
  if (quantidadeNumerica !== null) {
    const valor =
      (quantidadeNumerica * Number(fatorAtual)) / Number(fatorNovo);
    if (Math.abs(valor * 1000 - Math.round(valor * 1000)) > 1e-7) {
      return null;
    }
    quantidadeConvertida = valorDeEntrada(valor, 3);
  } else if (quantidade.trim() !== "") {
    return null;
  }

  const precoNumerico = numeroDeEntrada(preco);
  const precoConvertidoNumerico =
    precoNumerico === null
      ? null
      : (precoNumerico * Number(fatorNovo)) / Number(fatorAtual);
  const precoConvertido =
    precoConvertidoNumerico === null
      ? preco
      : valorDeEntrada(precoConvertidoNumerico, 2);

  return {
    quantidade: quantidadeConvertida,
    preco: precoConvertido,
    ajustePrecoNecessario:
      precoConvertidoNumerico !== null &&
      Math.abs(precoConvertidoNumerico * 100 - Math.round(precoConvertidoNumerico * 100)) >
        1e-7,
  };
}

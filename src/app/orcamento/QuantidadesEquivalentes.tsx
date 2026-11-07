import { formatarQuantidade } from "@/app/produtos/tipos";

type Props = {
  quantidadeBase: string;
  unidadeBase: string;
  embalagens: { unidade: string; fatorConversao: string }[];
};

export default function QuantidadesEquivalentes({
  quantidadeBase,
  unidadeBase,
  embalagens,
}: Props) {
  const unidadeBaseNormalizada = unidadeBase.trim().toLocaleUpperCase("pt-BR");
  const embalagensVisiveis = embalagens.filter(
    (embalagem) =>
      Number(embalagem.fatorConversao) > 0 &&
      embalagem.unidade.trim().toLocaleUpperCase("pt-BR") !==
        unidadeBaseNormalizada
  );

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span>
        {formatarQuantidade(Number(quantidadeBase))} {unidadeBase}
      </span>
      {embalagensVisiveis.map((embalagem, indice) => (
        <span
          key={`${embalagem.unidade}-${embalagem.fatorConversao}-${indice}`}
          className="text-xs text-zinc-500"
        >
          {formatarQuantidade(
            Number(quantidadeBase) / Number(embalagem.fatorConversao)
          )}{" "}
          {embalagem.unidade}
        </span>
      ))}
    </div>
  );
}

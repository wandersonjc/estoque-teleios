"use client";

import { useRouter } from "next/navigation";

type Props = {
  agrupamento: "cargo" | "funcao" | "";
};

export default function FiltroAgrupamentoUsuarios({
  agrupamento,
}: Props) {
  const router = useRouter();

  function atualizarAgrupamento(
    evento: React.ChangeEvent<HTMLInputElement>
  ) {
    const formulario = evento.currentTarget.form;
    if (!formulario) return;

    if (evento.currentTarget.checked) {
      formulario
        .querySelectorAll<HTMLInputElement>('input[name="agrupar"]')
        .forEach((checkbox) => {
          if (checkbox !== evento.currentTarget) checkbox.checked = false;
        });
    }

    const parametros = new URLSearchParams();
    new FormData(formulario).forEach((valor, chave) => {
      if (typeof valor === "string") parametros.append(chave, valor);
    });

    const query = parametros.toString();
    router.push(query ? `/usuarios?${query}` : "/usuarios", { scroll: false });
  }

  return (
    <>
      <label className="flex items-center gap-2 text-base text-zinc-800">
        <input
          type="checkbox"
          name="agrupar"
          value="cargo"
          defaultChecked={agrupamento === "cargo"}
          onChange={atualizarAgrupamento}
          className="h-5 w-5"
        />
        Agrupar por Cargo
      </label>
      <label className="flex items-center gap-2 text-base text-zinc-800">
        <input
          type="checkbox"
          name="agrupar"
          value="funcao"
          defaultChecked={agrupamento === "funcao"}
          onChange={atualizarAgrupamento}
          className="h-5 w-5"
        />
        Agrupar por Função
      </label>
    </>
  );
}

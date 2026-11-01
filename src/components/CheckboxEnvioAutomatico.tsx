"use client";

import { useRouter } from "next/navigation";

type Props = {
  name: string;
  value: string;
  defaultChecked: boolean;
  label: string;
  className?: string;
  checkboxClassName?: string;
};

export default function CheckboxEnvioAutomatico({
  name,
  value,
  defaultChecked,
  label,
  className = "flex items-center gap-2 text-base text-zinc-800",
  checkboxClassName = "h-5 w-5",
}: Props) {
  const router = useRouter();

  function navegarComFiltros(form: HTMLFormElement | null) {
    if (!form) return;

    const parametros = new URLSearchParams();
    new FormData(form).forEach((valor, chave) => {
      if (typeof valor === "string") parametros.append(chave, valor);
    });

    const caminho = form.getAttribute("action") || window.location.pathname;
    const query = parametros.toString();
    router.push(query ? `${caminho}?${query}` : caminho, { scroll: false });
  }

  return (
    <label className={className}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onChange={(evento) => {
          navegarComFiltros(evento.currentTarget.form);
        }}
        className={checkboxClassName}
      />
      {label}
    </label>
  );
}
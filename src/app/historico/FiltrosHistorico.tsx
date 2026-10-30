"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  usuarios: { id: number; nome: string }[];
  modulos: string[];
  acoes: string[];
  valoresIniciais: {
    modulo?: string;
    acao?: string;
    usuario?: string;
    inicio?: string;
    fim?: string;
    busca?: string;
  };
};

export default function FiltrosHistorico({
  usuarios,
  modulos,
  acoes,
  valoresIniciais,
}: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState(valoresIniciais.busca || "");

  function handleFiltrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    const b = formData.get("busca")?.toString();
    const m = formData.get("modulo")?.toString();
    const a = formData.get("acao")?.toString();
    const u = formData.get("usuario")?.toString();
    const i = formData.get("inicio")?.toString();
    const f = formData.get("fim")?.toString();

    if (b) params.set("busca", b);
    if (m) params.set("modulo", m);
    if (a) params.set("acao", a);
    if (u) params.set("usuario", u);
    if (i) params.set("inicio", i);
    if (f) params.set("fim", f);

    router.push(`/historico?${params.toString()}`);
  }

  function limparFiltros() {
    setBusca("");
    router.push("/historico");
  }

  return (
    <form
      onSubmit={handleFiltrar}
      className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Busca por texto */}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="busca" className="text-sm font-medium text-zinc-700">
            Buscar na descrição
          </label>
          <input
            id="busca"
            name="busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: 'Alterou produto', 'PF35'..."
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          />
        </div>

        {/* Módulo */}
        <div className="flex flex-col gap-1">
          <label htmlFor="modulo" className="text-sm font-medium text-zinc-700">
            Módulo
          </label>
          <select
            id="modulo"
            name="modulo"
            defaultValue={valoresIniciais.modulo || ""}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          >
            <option value="">Todos os módulos</option>
            {modulos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Ação */}
        <div className="flex flex-col gap-1">
          <label htmlFor="acao" className="text-sm font-medium text-zinc-700">
            Ação
          </label>
          <select
            id="acao"
            name="acao"
            defaultValue={valoresIniciais.acao || ""}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          >
            <option value="">Todas as ações</option>
            {acoes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Usuário */}
        <div className="flex flex-col gap-1">
          <label htmlFor="usuario" className="text-sm font-medium text-zinc-700">
            Usuário
          </label>
          <select
            id="usuario"
            name="usuario"
            defaultValue={valoresIniciais.usuario || ""}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          >
            <option value="">Todos os usuários</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="inicio" className="text-sm font-medium text-zinc-700">
              Início
            </label>
            <input
              id="inicio"
              name="inicio"
              type="date"
              defaultValue={valoresIniciais.inicio || ""}
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="fim" className="text-sm font-medium text-zinc-700">
              Fim
            </label>
            <input
              id="fim"
              name="fim"
              type="date"
              defaultValue={valoresIniciais.fim || ""}
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          className="h-11 flex-1 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
        >
          Aplicar Filtros
        </button>
        <button
          type="button"
          onClick={limparFiltros}
          className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Limpar
        </button>
      </div>
    </form>
  );
}

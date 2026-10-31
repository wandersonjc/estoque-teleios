"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { TAMANHO_MAXIMO_IMAGEM } from "@/lib/constantes-imagens";

type Props = {
  imagemUrl?: string;
  textoAlternativo: string;
  circular?: boolean;
};

export default function CampoImagem({
  imagemUrl,
  textoAlternativo,
  circular = false,
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selecionarImagem(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.currentTarget.files?.[0] ?? null;
    setErro("");

    if (arquivo && arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
      evento.currentTarget.value = "";
      setPreviewUrl(null);
      setErro("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setPreviewUrl(arquivo ? URL.createObjectURL(arquivo) : null);
  }

  const classeImagem = circular ? "rounded-full" : "rounded-lg";

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="imagem" className="text-base font-medium text-zinc-800">
        Imagem
      </label>
      {(previewUrl || imagemUrl) && (
        <Image
          src={previewUrl ?? imagemUrl ?? ""}
          alt={textoAlternativo}
          width={128}
          height={128}
          unoptimized
          className={`h-32 w-32 object-cover ${classeImagem}`}
        />
      )}
      <input
        id="imagem"
        name="imagem"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={selecionarImagem}
        className="w-full text-sm text-zinc-700 file:mr-3 file:h-11 file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:text-sm file:font-medium file:text-zinc-900"
      />
      <p className="text-sm text-zinc-500">JPEG, PNG ou WebP, até 5 MB.</p>
      {imagemUrl && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="removerImagem"
            value="1"
            className="h-4 w-4"
          />
          Remover imagem atual
        </label>
      )}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    </div>
  );
}
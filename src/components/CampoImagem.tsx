"use client";

import Cropper, { type Area } from "react-easy-crop";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  IconeCamera,
  IconeImagem,
  IconeImagemVazia,
  IconeExcluir,
} from "@/components/icones";
import { TAMANHO_MAXIMO_IMAGEM } from "@/lib/constantes-imagens";

type Props = {
  imagemUrl?: string;
  textoAlternativo: string;
  circular?: boolean;
};

type ModoDialogo = "camera" | "recorte" | null;

const TIPOS_IMAGEM_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const DIMENSAO_MAXIMA = 1200;

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new window.Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    imagem.src = src;
  });
}

async function criarImagemQuadrada(
  src: string,
  area: Area
): Promise<File> {
  const imagem = await carregarImagem(src);
  const tamanho = Math.max(
    1,
    Math.min(DIMENSAO_MAXIMA, Math.round(area.width))
  );
  const canvas = document.createElement("canvas");
  canvas.width = tamanho;
  canvas.height = tamanho;

  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível processar a imagem.");

  contexto.drawImage(
    imagem,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    tamanho,
    tamanho
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  );
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  if (blob.size > TAMANHO_MAXIMO_IMAGEM) {
    throw new Error("A imagem ajustada excede o limite de 5 MB.");
  }

  return new File([blob], "imagem.webp", { type: "image/webp" });
}

export default function CampoImagem({
  imagemUrl,
  textoAlternativo,
  circular = false,
}: Props) {
  const seletorArquivoRef = useRef<HTMLInputElement>(null);
  const arquivoEnvioRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [origemRecorte, setOrigemRecorte] = useState<string | null>(null);
  const [modoDialogo, setModoDialogo] = useState<ModoDialogo>(null);
  const [areaRecorte, setAreaRecorte] = useState<Area | null>(null);
  const [posicaoRecorte, setPosicaoRecorte] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cameraPronta, setCameraPronta] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [removerImagem, setRemoverImagem] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (origemRecorte) URL.revokeObjectURL(origemRecorte);
    };
  }, [origemRecorte]);

  useEffect(() => {
    if (modoDialogo !== "camera") return;

    let desmontado = false;

    async function iniciarCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador não permite acessar a câmera.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (desmontado) {
          stream.getTracks().forEach((faixa) => faixa.stop());
          return;
        }

        cameraStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraPronta(true);
      } catch {
        if (!desmontado) {
          setErro("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
        }
      }
    }

    void iniciarCamera();

    return () => {
      desmontado = true;
      cameraStreamRef.current?.getTracks().forEach((faixa) => faixa.stop());
      cameraStreamRef.current = null;
    };
  }, [modoDialogo]);

  function abrirRecorte(src: string) {
    setOrigemRecorte(src);
    setAreaRecorte(null);
    setPosicaoRecorte({ x: 0, y: 0 });
    setZoom(1);
    setModoDialogo("recorte");
    setErro("");
  }

  function selecionarImagem(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.currentTarget.files?.[0];
    evento.currentTarget.value = "";
    if (!arquivo) return;

    setErro("");
    if (!TIPOS_IMAGEM_ACEITOS.includes(arquivo.type)) {
      setErro("Use uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
      setErro("A imagem deve ter no máximo 5 MB.");
      return;
    }

    abrirRecorte(URL.createObjectURL(arquivo));
  }

  async function capturarCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    setProcessando(true);
    setErro("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("Não foi possível capturar a imagem.");
      contexto.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.9)
      );
      if (!blob) throw new Error("Não foi possível capturar a imagem.");
      if (blob.size > TAMANHO_MAXIMO_IMAGEM) {
        throw new Error("A imagem capturada excede o limite de 5 MB.");
      }

      abrirRecorte(URL.createObjectURL(blob));
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível capturar a imagem."
      );
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarRecorte() {
    if (!origemRecorte || !areaRecorte || !arquivoEnvioRef.current) return;

    setProcessando(true);
    setErro("");
    try {
      const arquivo = await criarImagemQuadrada(origemRecorte, areaRecorte);
      const transferencia = new DataTransfer();
      transferencia.items.add(arquivo);
      arquivoEnvioRef.current.files = transferencia.files;
      setRemoverImagem(false);
      setPreviewUrl(URL.createObjectURL(arquivo));
      setModoDialogo(null);
      setOrigemRecorte(null);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível ajustar a imagem."
      );
    } finally {
      setProcessando(false);
    }
  }

  function fecharDialogo() {
    setModoDialogo(null);
    setOrigemRecorte(null);
    setErro("");
  }

  function removerImagemSelecionada() {
    if (arquivoEnvioRef.current) arquivoEnvioRef.current.value = "";
    setPreviewUrl(null);
    setRemoverImagem(Boolean(imagemUrl));
    setErro("");
  }

  const imagemAtual = removerImagem ? null : previewUrl ?? imagemUrl;
  const classeImagem = circular ? "rounded-full" : "rounded-lg";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-medium text-zinc-800">Imagem</span>

      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        {imagemAtual ? (
          <Image
            src={imagemAtual}
            alt={textoAlternativo}
            width={128}
            height={128}
            unoptimized
            className={`h-full w-full object-cover ${classeImagem}`}
          />
        ) : (
          <IconeImagemVazia className="h-12 w-12 text-zinc-400" />
        )}
      </div>

      <input
        ref={seletorArquivoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={selecionarImagem}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={arquivoEnvioRef}
        id="imagem"
        name="imagem"
        type="file"
        accept="image/webp"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        type="hidden"
        name="removerImagem"
        value={removerImagem ? "1" : ""}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Selecionar imagem do dispositivo"
          aria-label="Selecionar imagem do dispositivo"
          onClick={() => seletorArquivoRef.current?.click()}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
        >
          <IconeImagem className="h-5 w-5" />
        </button>
        <button
          type="button"
          title="Abrir câmera"
          aria-label="Abrir câmera"
          onClick={() => {
            setErro("");
            setCameraPronta(false);
            setModoDialogo("camera");
          }}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
        >
          <IconeCamera className="h-5 w-5" />
        </button>
        {(previewUrl || (imagemUrl && !removerImagem)) && (
          <button
            type="button"
            title="Remover imagem"
            aria-label="Remover imagem"
            onClick={removerImagemSelecionada}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
          >
            <IconeExcluir className="h-5 w-5" />
          </button>
        )}
      </div>

      <p className="text-sm text-zinc-500">JPEG, PNG ou WebP, até 5 MB.</p>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}

      {modoDialogo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) fecharDialogo();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialogo-imagem-titulo"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="dialogo-imagem-titulo"
                className="text-lg font-semibold text-zinc-900"
              >
                {modoDialogo === "camera" ? "Câmera" : "Ajustar imagem"}
              </h2>
              <button
                type="button"
                onClick={fecharDialogo}
                aria-label="Fechar"
                title="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 text-xl text-zinc-700 hover:bg-zinc-50"
              >
                ×
              </button>
            </div>

            {modoDialogo === "camera" ? (
              <div className="flex flex-col gap-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-square w-full rounded-lg bg-black object-cover"
                />
                {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
                <button
                  type="button"
                  onClick={capturarCamera}
                  disabled={!cameraPronta || processando}
                  className="h-12 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-50"
                >
                  {processando ? "Capturando..." : "Capturar imagem"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {origemRecorte && (
                  <div className="relative mx-auto aspect-square w-full max-w-[min(100%,28rem)] overflow-hidden rounded-lg bg-zinc-950">
                    <Cropper
                      image={origemRecorte}
                      crop={posicaoRecorte}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setPosicaoRecorte}
                      onZoomChange={setZoom}
                      onCropComplete={(_area, areaPixels) =>
                        setAreaRecorte(areaPixels)
                      }
                    />
                  </div>
                )}
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(evento) => setZoom(Number(evento.currentTarget.value))}
                    className="w-full accent-zinc-900"
                  />
                </label>
                {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={fecharDialogo}
                    disabled={processando}
                    className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarRecorte}
                    disabled={!areaRecorte || processando}
                    className="h-11 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {processando ? "Processando..." : "Usar imagem"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
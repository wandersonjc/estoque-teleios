import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
<<<<<<< HEAD
    name: "Átria Conecta",
=======
    name: "Átria Conecta | Gestão empresarial",
>>>>>>> d7640595e9d6e1c23af8c9c07a331a9f859bfffc
    short_name: "Átria Conecta",
    description: "Sistema de gestão de produtos e estoque Átria Conecta",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#002855",
    icons: [
      {
        src: "/imagens/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/imagens/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
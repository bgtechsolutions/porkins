import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Porkin — Controle financeiro",
    short_name: "Porkin",
    description: "Finanças pessoais e planejamento da Casa em um só lugar.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#16a34a",
    lang: "pt-BR",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}

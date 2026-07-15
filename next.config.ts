import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixa a raiz do projeto (havia outro package-lock.json na home do usuário)
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;

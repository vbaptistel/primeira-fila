import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@primeira-fila/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com"
      },
      {
        protocol: "https",
        hostname: "placehold.co"
      },
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;

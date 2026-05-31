import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // serverExternalPackages replaces the deprecated serverComponentsExternalPackages
  serverExternalPackages: [],
  async rewrites() {
    return [
      {
        // Proxy /api/backend/* → FastAPI at localhost:8000/api/v1/*
        // Useful for same-origin SSE and file uploads in dev
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

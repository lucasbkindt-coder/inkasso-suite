import type { NextConfig } from "next";

const apiUrl = process.env.RISEPAY_API_INTERNAL_URL ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const apiRewriteTarget = process.env.API_REWRITE_TARGET ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiRewriteTarget}/api/:path*`
      }
    ];
  }
};

export default nextConfig;

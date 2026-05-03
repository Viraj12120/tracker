import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['knex', '@napi-rs/canvas', 'pdf-parse'],
};

export default nextConfig;

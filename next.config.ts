import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    config.resolve.alias['@tensorflow/tfjs-node'] = '@tensorflow/tfjs';
    return config;
  },
  experimental: {
  },
};

export default nextConfig;

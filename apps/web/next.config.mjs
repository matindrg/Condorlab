/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@condorlab/shared'],
};

export default nextConfig;

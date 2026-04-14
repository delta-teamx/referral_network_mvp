/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@refnet/shared'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;

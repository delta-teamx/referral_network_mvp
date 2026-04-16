/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — emits HTML/JS to `out/` so Netlify can serve it as plain
  // static files with no plugin dance. All dynamic routes pre-render via
  // `generateStaticParams` (see listing/[slug]/page.tsx, connect/[event]/page.tsx).
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@refnet/shared'],
  trailingSlash: true,
  images: {
    // next/image optimizer can't run on a static host; disable it.
    unoptimized: true,
  },
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;

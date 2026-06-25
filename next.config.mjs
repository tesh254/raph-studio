/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the dashboard fetches the local raph studio API entirely
  // client-side, so it can be hosted as static assets on Cloudflare Pages.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;

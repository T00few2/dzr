/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

export async function rewrites() {
    return [
      {
        source: '/api/python/:path*',
        destination: 'http://127.0.0.1:5328/:path*', // Proxy to Backend
      },
    ];
  }

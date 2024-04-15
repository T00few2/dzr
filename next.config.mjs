/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/python/:path*',
        destination: 'http://127.0.0.1:5328/:path*', // Proxy to Backend
      },
    ];
  }
};

export default nextConfig;

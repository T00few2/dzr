/** @type {import('next').NextConfig} */
const elevationFiles = [
  './node_modules/zwift-data/lib/streams/routes/**/*',
  './node_modules/zwift-data/lib/streams/segments/**/*',
]

const nextConfig = {
  // The profile API reads one route file by name. Next cannot see that path, so the files never reach Vercel.
  experimental: {
    outputFileTracingIncludes: {
      '/api/route-profile': elevationFiles,
      '/api/route-profile/route': elevationFiles,
    },
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/apps/**'],
    }
    return config
  },
}

export default nextConfig

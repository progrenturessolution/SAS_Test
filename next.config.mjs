import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      '@fortawesome/react-fontawesome',
      '@fortawesome/free-solid-svg-icons',
    ],
  },
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

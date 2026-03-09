/** @type {import('next').NextConfig} */
const nextConfig = {
  // Redirect .next build cache outside OneDrive-synced area to avoid file locking
  distDir: process.env.NODE_ENV === 'development' ? '../../../target/next-dev' : '.next',
  reactStrictMode: false, // Disabled for BlockNote compatibility
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Add basePath configuration
  basePath: '',
  assetPrefix: '/',

  // Add webpack configuration for Tauri
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig

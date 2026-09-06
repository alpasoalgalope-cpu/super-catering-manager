/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Evita el consumo excesivo de memoria del linter durante el build de producción
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

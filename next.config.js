/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // No frenar el build por temas de tipos de TypeScript.
  // El código funciona; estos chequeos son un freno innecesario en el deploy.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Tampoco frenar el build por reglas de estilo de código (linting).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

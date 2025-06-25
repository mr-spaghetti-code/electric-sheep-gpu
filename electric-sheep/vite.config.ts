import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable source maps for better debugging
    sourcemap: true,
    // Optimize for better SEO and performance
    rollupOptions: {
      output: {
        // Better chunk splitting for caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-label', '@radix-ui/react-select', '@radix-ui/react-slider'],
          router: ['react-router-dom'],
        },
      },
    },
    // Enable minification
    minify: 'esbuild',
    // Target modern browsers for better performance
    target: 'esnext',
  },
  // Server configuration for development
  server: {
    // Custom headers for better security
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    }
  },
  // Preview configuration
  preview: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  }
})
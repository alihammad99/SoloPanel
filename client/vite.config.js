import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Rewrite backend redirects from localhost:8080 -> localhost:5173
            if (proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location
                .replace('http://localhost:8080', 'http://localhost:5173')
            }
          })
        }
      }
    }
  },
  build: {
    outDir: '../server/static',
    emptyOutDir: true,
  }
})

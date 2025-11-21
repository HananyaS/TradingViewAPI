import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'static/dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@heroicons/react', 'react-hot-toast'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',  // Proxy FROM Vite(5173) TO Flask(5000)
        changeOrigin: false,  // Keep Host header as localhost:5173 for cookie sharing
        secure: false,
        ws: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Explicitly set Host header to localhost:5173
            proxyReq.setHeader('Host', 'localhost:5173');
            console.log('🔄 Proxying:', req.method, req.url, '→', options.target);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('✅ Response:', req.url, '→', proxyRes.statusCode);
          });
        },
      },
      '/login': {
        target: 'http://localhost:5000',  // Proxy FROM Vite(5173) TO Flask(5000)
        changeOrigin: false,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Host', 'localhost:5173');
          });
        },
      },
      '/logout': {
        target: 'http://localhost:5000',  // Proxy FROM Vite(5173) TO Flask(5000)
        changeOrigin: false,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Host', 'localhost:5173');
          });
        },
      },
      '/oauth2callback': {
        target: 'http://localhost:5000',  // Proxy FROM Vite(5173) TO Flask(5000)
        changeOrigin: false,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Explicitly set Host header to localhost:5173 so Flask sets cookies for correct domain
            proxyReq.setHeader('Host', 'localhost:5173');
            console.log('🔄 OAuth Callback - Set Host header to: localhost:5173');
          });
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})


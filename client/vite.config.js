import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'favicon.ico'],
      manifest: {
        name: 'MultiShop — Management System',
        short_name: 'MultiShop',
        description: 'Multi-shop inventory, billing, and analytics management system',
        start_url: '/dashboard',
        display: 'standalone',
        background_color: '#0F172A',
        theme_color: '#2563eb',
        orientation: 'portrait-primary',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Billing',
            short_name: 'Billing',
            description: 'Open Point of Sale',
            url: '/billing',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Orders',
            short_name: 'Orders',
            description: 'View order history',
            url: '/orders',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          // API: NetworkFirst — use cache when offline (stale data is better than nothing)
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName:            'api-cache',
              expiration:           { maxEntries: 100, maxAgeSeconds: 60 * 60 }, // 1hr
              networkTimeoutSeconds: 8,
              // On failure (offline), fall back to cached response
              fetchOptions: { credentials: 'include' },
            },
          },
          // Images: CacheFirst — long-lived, rarely change
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName:  'image-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        skipWaiting:  true,
        clientsClaim: true,
        // Allow SPA navigation to /billing, /dashboard, /orders while offline
        navigateFallback:       '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/sw\.js/],
      },
      devOptions: {
        enabled: false, // disable in dev to avoid noise
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          // Data / state
          'vendor-query':   ['@tanstack/react-query', 'zustand', 'axios'],
          // UI animation
          'vendor-motion':  ['framer-motion'],
          // Charts (heavy)
          'vendor-recharts':['recharts'],
          // Icons (tree-shaken, but grouping helps caching)
          'vendor-lucide':  ['lucide-react'],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});

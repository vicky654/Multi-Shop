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
        // Network-first for API calls
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        // Don't cache login/register pages to avoid auth issues
        navigateFallbackDenylist: [/^\/api/, /^\/shop/],
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
    port: 4000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});

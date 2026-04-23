import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      // Automatically update the service worker without requiring user confirmation
      registerType: 'autoUpdate',

      // Include these file types in the Workbox pre-cache manifest
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],

      workbox: {
        // Cache all standard static assets on install
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Runtime caching: API calls served from network-first, fallback to cache
        runtimeCaching: [
          {
            // Cache the backend health probe so the status indicator works offline
            urlPattern: ({ url }) => url.pathname.startsWith('/api/health'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-health-cache',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 },
            },
          },
          {
            // Cache the offline knowledge base JSON for Fuse.js lookup
            urlPattern: ({ url }) => url.pathname === '/offline_graph.json',
            handler: 'CacheFirst',
            options: {
              cacheName: 'offline-graph-cache',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
            },
          },
        ],
      },

      // Web App Manifest
      manifest: {
        name: 'GraphSentinel',
        short_name: 'GraphSentinel',
        description: 'GraphSentinel — AI powered by knowledge graphs for enterprise support',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#0f0f1a',
        background_color: '#0f0f1a',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['business', 'productivity', 'utilities'],
      },

      // Dev options — enable service worker in development for testing
      devOptions: {
        enabled: false, // Set to true temporarily when testing PWA locally
        type: 'module',
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
  },
})

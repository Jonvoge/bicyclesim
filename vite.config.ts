import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Minimal ambient so we can read the deploy env var without pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

// When deploying to GitHub Pages the app is served from a subpath
// (https://<user>.github.io/bicyclesim/). The deploy workflow sets BASE_PATH;
// local dev/build default to root.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bicycle Sim',
        short_name: 'BicycleSim',
        description: 'A Kairosoft-style cycling team-manager game.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});

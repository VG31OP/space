import path from "node:path";
import { defineConfig } from "vite";
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
  resolve: {
    alias: {
      "@zip.js/zip.js/lib/zip-no-worker.js": path.resolve(
        __dirname,
        "node_modules/@zip.js/zip.js/index.js",
      ),
    },
  },
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/map": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});

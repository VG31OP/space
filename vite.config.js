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
      "/api/celestrak": {
        target: "https://celestrak.org",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/celestrak/, ""),
      },
      "/api/news": {
        target: "https://newsapi.org",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/news/, ""),
      },
      "/api/bbc": {
        target: "https://feeds.bbci.co.uk",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/bbc/, ""),
      },
      "/api/reuters": {
        target: "https://feeds.reuters.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/reuters/, ""),
      },
      "/api/aljazeera": {
        target: "https://www.aljazeera.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/aljazeera/, ""),
      },
      "/api/firms": {
        target: "https://firms.modaps.eosdis.nasa.gov",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/firms/, ""),
      },
      "/api/eonet": {
        target: "https://eonet.gsfc.nasa.gov",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/eonet/, "/api/v3"),
      },
      "/api/usgs": {
        target: "https://earthquake.usgs.gov",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/usgs/, "/earthquakes/feed/v1.0/summary"),
      },
    },
  },
});

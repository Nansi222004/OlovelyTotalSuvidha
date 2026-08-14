// vite.config.ts
import { defineConfig } from "file:///C:/Users/AnkitAhirwar/OneDrive/Desktop/dhakadsnazzy/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/AnkitAhirwar/OneDrive/Desktop/dhakadsnazzy/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";

// vite-plugin-serve-assets.ts
import { readFileSync, existsSync } from "fs";
import { join, resolve, extname } from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/AnkitAhirwar/OneDrive/Desktop/dhakadsnazzy/frontend/vite-plugin-serve-assets.ts";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname2 = resolve(__filename, "..");
function serveAssetsPlugin() {
  return {
    name: "serve-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        if (url?.startsWith("/assets/")) {
          const assetPath = url.replace("/assets/", "");
          const assetsDir = resolve(__dirname2, "assets");
          const fullPath = join(assetsDir, assetPath);
          if (!fullPath.startsWith(assetsDir)) {
            return next();
          }
          if (existsSync(fullPath)) {
            const ext = extname(fullPath).toLowerCase();
            const mimeTypes = {
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".png": "image/png",
              ".gif": "image/gif",
              ".webp": "image/webp",
              ".svg": "image/svg+xml",
              ".mp4": "video/mp4",
              ".webm": "video/webm"
            };
            const contentType = mimeTypes[ext] || "application/octet-stream";
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            const file = readFileSync(fullPath);
            res.end(file);
            return;
          }
        }
        next();
      });
    }
  };
}

// vite.config.ts
var __vite_injected_original_dirname = "C:\\Users\\AnkitAhirwar\\OneDrive\\Desktop\\dhakadsnazzy\\frontend";
var vite_config_default = defineConfig({
  plugins: [react(), serveAssetsPlugin()],
  assetsInclude: ["**/*.jpg", "**/*.jpeg", "**/*.png", "**/*.webp"],
  server: {
    fs: {
      strict: false
    },
    middlewareMode: false
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@assets": path.resolve(__vite_injected_original_dirname, "./assets")
    }
  },
  optimizeDeps: {
    exclude: []
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAidml0ZS1wbHVnaW4tc2VydmUtYXNzZXRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQW5raXRBaGlyd2FyXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcU3BlZVVwXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBbmtpdEFoaXJ3YXJcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxTcGVlVXBcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0Fua2l0QWhpcndhci9PbmVEcml2ZS9EZXNrdG9wL1NwZWVVcC9mcm9udGVuZC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcclxuaW1wb3J0IHsgc2VydmVBc3NldHNQbHVnaW4gfSBmcm9tICcuL3ZpdGUtcGx1Z2luLXNlcnZlLWFzc2V0cydcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCksIHNlcnZlQXNzZXRzUGx1Z2luKCldLFxyXG4gIGFzc2V0c0luY2x1ZGU6IFsnKiovKi5qcGcnLCAnKiovKi5qcGVnJywgJyoqLyoucG5nJywgJyoqLyoud2VicCddLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgZnM6IHtcclxuICAgICAgc3RyaWN0OiBmYWxzZSxcclxuICAgIH0sXHJcbiAgICBtaWRkbGV3YXJlTW9kZTogZmFsc2UsXHJcbiAgfSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxyXG4gICAgICAnQGFzc2V0cyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL2Fzc2V0cycpLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgZXhjbHVkZTogW10sXHJcbiAgfSxcclxufSlcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBbmtpdEFoaXJ3YXJcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxTcGVlVXBcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEFua2l0QWhpcndhclxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXFNwZWVVcFxcXFxmcm9udGVuZFxcXFx2aXRlLXBsdWdpbi1zZXJ2ZS1hc3NldHMudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0Fua2l0QWhpcndhci9PbmVEcml2ZS9EZXNrdG9wL1NwZWVVcC9mcm9udGVuZC92aXRlLXBsdWdpbi1zZXJ2ZS1hc3NldHMudHNcIjtpbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XHJcbmltcG9ydCB7IGpvaW4sIHJlc29sdmUsIGV4dG5hbWUgfSBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XHJcbmltcG9ydCB0eXBlIHsgSW5jb21pbmdNZXNzYWdlLCBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gJ2h0dHAnO1xyXG5cclxuY29uc3QgX19maWxlbmFtZSA9IGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKTtcclxuY29uc3QgX19kaXJuYW1lID0gcmVzb2x2ZShfX2ZpbGVuYW1lLCAnLi4nKTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzZXJ2ZUFzc2V0c1BsdWdpbigpOiBQbHVnaW4ge1xyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAnc2VydmUtYXNzZXRzJyxcclxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcclxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxOiBJbmNvbWluZ01lc3NhZ2UsIHJlczogU2VydmVyUmVzcG9uc2UsIG5leHQ6ICgpID0+IHZvaWQpID0+IHtcclxuICAgICAgICAvLyBPbmx5IGhhbmRsZSAvYXNzZXRzLyogcmVxdWVzdHNcclxuICAgICAgICBjb25zdCB1cmwgPSByZXEudXJsO1xyXG4gICAgICAgIGlmICh1cmw/LnN0YXJ0c1dpdGgoJy9hc3NldHMvJykpIHtcclxuICAgICAgICAgIGNvbnN0IGFzc2V0UGF0aCA9IHVybC5yZXBsYWNlKCcvYXNzZXRzLycsICcnKTtcclxuICAgICAgICAgIGNvbnN0IGFzc2V0c0RpciA9IHJlc29sdmUoX19kaXJuYW1lLCAnYXNzZXRzJyk7XHJcbiAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IGpvaW4oYXNzZXRzRGlyLCBhc3NldFBhdGgpO1xyXG5cclxuICAgICAgICAgIC8vIFNlY3VyaXR5OiBwcmV2ZW50IGRpcmVjdG9yeSB0cmF2ZXJzYWxcclxuICAgICAgICAgIGlmICghZnVsbFBhdGguc3RhcnRzV2l0aChhc3NldHNEaXIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXh0KCk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgaWYgKGV4aXN0c1N5bmMoZnVsbFBhdGgpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IGV4dG5hbWUoZnVsbFBhdGgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IG1pbWVUeXBlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcclxuICAgICAgICAgICAgICAnLmpwZyc6ICdpbWFnZS9qcGVnJyxcclxuICAgICAgICAgICAgICAnLmpwZWcnOiAnaW1hZ2UvanBlZycsXHJcbiAgICAgICAgICAgICAgJy5wbmcnOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgICAgICAnLmdpZic6ICdpbWFnZS9naWYnLFxyXG4gICAgICAgICAgICAgICcud2VicCc6ICdpbWFnZS93ZWJwJyxcclxuICAgICAgICAgICAgICAnLnN2Zyc6ICdpbWFnZS9zdmcreG1sJyxcclxuICAgICAgICAgICAgICAnLm1wNCc6ICd2aWRlby9tcDQnLFxyXG4gICAgICAgICAgICAgICcud2VibSc6ICd2aWRlby93ZWJtJyxcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gbWltZVR5cGVzW2V4dF0gfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSc7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIGNvbnRlbnRUeXBlKTtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICdwdWJsaWMsIG1heC1hZ2U9MzE1MzYwMDAsIGltbXV0YWJsZScpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgZmlsZSA9IHJlYWRGaWxlU3luYyhmdWxsUGF0aCk7XHJcbiAgICAgICAgICAgIHJlcy5lbmQoZmlsZSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgbmV4dCgpO1xyXG4gICAgICB9KTtcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG5cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFrVyxTQUFTLG9CQUFvQjtBQUMvWCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVOzs7QUNEakIsU0FBUyxjQUFjLGtCQUFrQjtBQUN6QyxTQUFTLE1BQU0sU0FBUyxlQUFlO0FBQ3ZDLFNBQVMscUJBQXFCO0FBSGdOLElBQU0sMkNBQTJDO0FBTS9SLElBQU0sYUFBYSxjQUFjLHdDQUFlO0FBQ2hELElBQU1BLGFBQVksUUFBUSxZQUFZLElBQUk7QUFFbkMsU0FBUyxvQkFBNEI7QUFDMUMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQVE7QUFDdEIsYUFBTyxZQUFZLElBQUksQ0FBQyxLQUFzQixLQUFxQixTQUFxQjtBQUV0RixjQUFNLE1BQU0sSUFBSTtBQUNoQixZQUFJLEtBQUssV0FBVyxVQUFVLEdBQUc7QUFDL0IsZ0JBQU0sWUFBWSxJQUFJLFFBQVEsWUFBWSxFQUFFO0FBQzVDLGdCQUFNLFlBQVksUUFBUUEsWUFBVyxRQUFRO0FBQzdDLGdCQUFNLFdBQVcsS0FBSyxXQUFXLFNBQVM7QUFHMUMsY0FBSSxDQUFDLFNBQVMsV0FBVyxTQUFTLEdBQUc7QUFDbkMsbUJBQU8sS0FBSztBQUFBLFVBQ2Q7QUFFQSxjQUFJLFdBQVcsUUFBUSxHQUFHO0FBQ3hCLGtCQUFNLE1BQU0sUUFBUSxRQUFRLEVBQUUsWUFBWTtBQUMxQyxrQkFBTSxZQUFvQztBQUFBLGNBQ3hDLFFBQVE7QUFBQSxjQUNSLFNBQVM7QUFBQSxjQUNULFFBQVE7QUFBQSxjQUNSLFFBQVE7QUFBQSxjQUNSLFNBQVM7QUFBQSxjQUNULFFBQVE7QUFBQSxjQUNSLFFBQVE7QUFBQSxjQUNSLFNBQVM7QUFBQSxZQUNYO0FBRUEsa0JBQU0sY0FBYyxVQUFVLEdBQUcsS0FBSztBQUN0QyxnQkFBSSxVQUFVLGdCQUFnQixXQUFXO0FBQ3pDLGdCQUFJLFVBQVUsaUJBQWlCLHFDQUFxQztBQUVwRSxrQkFBTSxPQUFPLGFBQWEsUUFBUTtBQUNsQyxnQkFBSSxJQUFJLElBQUk7QUFDWjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQ0EsYUFBSztBQUFBLE1BQ1AsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0Y7OztBRHBEQSxJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLGtCQUFrQixDQUFDO0FBQUEsRUFDdEMsZUFBZSxDQUFDLFlBQVksYUFBYSxZQUFZLFdBQVc7QUFBQSxFQUNoRSxRQUFRO0FBQUEsSUFDTixJQUFJO0FBQUEsTUFDRixRQUFRO0FBQUEsSUFDVjtBQUFBLElBQ0EsZ0JBQWdCO0FBQUEsRUFDbEI7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUNwQyxXQUFXLEtBQUssUUFBUSxrQ0FBVyxVQUFVO0FBQUEsSUFDL0M7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUM7QUFBQSxFQUNaO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsiX19kaXJuYW1lIl0KfQo=


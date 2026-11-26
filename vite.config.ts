import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Só ativa o modo estático quando o build vem do GitHub Pages
const isPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    ...(isPages && {
      spa: {
        enabled: true,
        prerender: { outputPath: "/index.html", crawlLinks: true },
      },
    }),
  },
  vite: {
    base: isPages ? "/etiquetas-da-planilha/" : "/",
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  define: { global: "globalThis" },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          web3: ["wagmi", "viem", "@tanstack/react-query"],
          rainbow: ["@rainbow-me/rainbowkit"],
          merkle: ["@openzeppelin/merkle-tree"],
        },
      },
    },
  },
});

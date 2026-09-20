// Arranca el servidor de desarrollo y abre un túnel público (Cloudflare Quick Tunnel)
// para poder ver la app desde cualquier navegador, como el enlace de vista previa de Lovable.
//
//   npm run share
//
// No requiere cuenta. La URL cambia cada vez que se ejecuta y solo funciona mientras
// este proceso siga abierto (Ctrl+C para detener).
import { spawn } from "node:child_process";

const PORT = 8080;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(cmd, args, onLine) {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
  const handle = (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    onLine?.(text);
  };
  child.stdout.on("data", handle);
  child.stderr.on("data", handle);
  return child;
}

console.log("▶ Iniciando servidor de desarrollo en el puerto " + PORT + "...");
const dev = run(npx, ["vite", "dev", "--port", String(PORT), "--strictPort"]);

let announced = false;
console.log("▶ Abriendo túnel público...");
const tunnel = run(npx, ["--yes", "cloudflared", "tunnel", "--url", `http://localhost:${PORT}`], (text) => {
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !announced) {
    announced = true;
    console.log("\n" + "=".repeat(64));
    console.log("  ✅ Tu app está disponible en:");
    console.log("     " + match[0]);
    console.log("     (pégalo en cualquier navegador o compártelo para validar)");
    console.log("=".repeat(64) + "\n");
  }
});

function shutdown() {
  dev.kill();
  tunnel.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
dev.on("exit", shutdown);
tunnel.on("exit", (code) => {
  if (!announced) console.error("✖ El túnel se cerró antes de generar una URL (código " + code + ").");
  shutdown();
});

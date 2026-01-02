import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const PUBLIC_DIR = join(__dirname, "public");

const resolvePath = (pathname: string) => {
  const decoded = decodeURIComponent(pathname);
  const requested = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const fullPath = resolve(PUBLIC_DIR, requested);
  return fullPath.startsWith(PUBLIC_DIR) ? fullPath : null;
};

const serveFile = async (path: string) => {
  const file = Bun.file(path);
  if (await file.exists()) {
    return new Response(file, { status: 200 });
  }
  return null;
};

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = resolvePath(url.pathname);

    if (!filePath) {
      return new Response("Forbidden", { status: 403 });
    }

    const fileResponse = await serveFile(filePath);
    if (fileResponse) {
      return fileResponse;
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);

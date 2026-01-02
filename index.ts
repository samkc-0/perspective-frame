const port = Number(process.env.PORT ?? 3000);
const htmlFile = Bun.file("public/index.html");

const server = Bun.serve({
  port,
  fetch() {
    return new Response(htmlFile, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`Serving public/index.html at http://localhost:${server.port}`);

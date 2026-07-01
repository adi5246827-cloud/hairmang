// Minimal zero-dependency HTTP server for the Railway "Backend" service.
// The real business logic lives in Supabase Edge Functions (supabase/functions);
// this process exists so the Backend service has something to build and run on
// Railway. It reads PORT from the environment (Railway injects it) and exposes a
// health check plus a small JSON status endpoint.
const http = require("http");

const PORT = process.env.PORT || 3000;
const ENV = process.env.RAILWAY_ENVIRONMENT_NAME || "local";

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      service: "hairmang-backend",
      message: "SalonOS backend is running",
      environment: ENV,
      time: new Date().toISOString(),
    })
  );
});

server.listen(PORT, () => {
  console.log(`hairmang-backend listening on port ${PORT} (env: ${ENV})`);
});

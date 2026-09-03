import http from 'http';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer | null = null;

async function isServerRunning(port = 5173): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/auth/login`, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function setup() {
  const alreadyRunning = await isServerRunning(5173);
  if (!alreadyRunning) {
    console.log('🚀 Starting Vite test server on port 5173...');
    server = await createServer({
      server: { port: 5173, host: 'localhost' },
      logLevel: 'warn',
    });
    await server.listen(5173);
    console.log('✅ Vite test server ready on port 5173');
  }
}

export async function teardown() {
  if (server) {
    console.log('🛑 Shutting down Vite test server...');
    await server.close();
  }
}

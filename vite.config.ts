import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        try {
          let body: any = null;
          if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            if (rawBody) {
              try {
                body = JSON.parse(rawBody);
              } catch {
                body = rawBody;
              }
            }
          }
          (req as any).body = body;

          (res as any).status = (statusCode: number) => {
            res.statusCode = statusCode;
            return res;
          };
          (res as any).json = (data: any) => {
            if (!res.headersSent) {
              res.setHeader('Content-Type', 'application/json');
            }
            res.end(JSON.stringify(data));
          };
          (res as any).send = (data: any) => {
            res.end(data);
          };

          // @ts-ignore
          const apiModule = await import('./api/index.js');
          const handler = apiModule.default || apiModule;
          await handler(req, res);
        } catch (error: any) {
          console.error('API middleware error:', error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message || 'Internal Server Error' }));
          }
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const envAll = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, envAll);

  const plugins = [react(), tailwindcss(), apiDevPlugin()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    server: {
      host: true,
      port: 5173,
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              if (id.includes('html5-qrcode') || id.includes('react-qr-code') || id.includes('qrcode')) {
                return 'vendor-qrcode';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('react-router') || id.includes('react-router-dom')) {
                return 'vendor-router';
              }
              if (id.includes('i18next') || id.includes('react-i18next')) {
                return 'vendor-i18n';
              }
              return 'vendor-core';
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
  };
})

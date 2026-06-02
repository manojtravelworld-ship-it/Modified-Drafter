import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger middleware
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.path}`);
    next();
  });

  // Dynamic Vercel serverless loader
  app.all('/api/*', async (req, res, next) => {
    let relativePath = req.path;
    // Strip trailing slash
    if (relativePath.endsWith('/')) {
      relativePath = relativePath.slice(0, -1);
    }

    const fileCandidates = [
      path.join(__dirname, relativePath + '.js'),
      path.join(__dirname, relativePath, 'index.js')
    ];

    let foundFile = null;
    for (const candidate of fileCandidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        foundFile = candidate;
        break;
      }
    }

    if (foundFile) {
      try {
        console.log(`[API Routing] Mapping ${req.method} ${req.path} to ${foundFile}`);
        const modulePath = 'file://' + foundFile;
        const { default: handler } = await import(modulePath);
        if (typeof handler === 'function') {
          await handler(req, res);
        } else {
          console.error(`ERROR: Handler in ${foundFile} is not a default exported function`);
          res.status(500).json({ error: 'Endpoint handler is not a function' });
        }
      } catch (err) {
        console.error(`ERROR: Exception in API handler ${foundFile}:`, err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
      }
    } else {
      console.warn(`[API Proxy] No server handler found for path ${req.path}`);
      res.status(404).json({ error: `API endpoint ${req.path} not found` });
    }
  });

  // Vite middleware or Static files serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Mounted Vite middleware (Dev Mode)');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[Server] Serving static files from ${distPath} (Prod Mode)`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

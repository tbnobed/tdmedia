import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from 'path';
import fs from 'fs';

// Log the database connection type (useful for Docker debugging)
if (process.env.DOCKER_ENV) {
  console.log('Using standard PostgreSQL client (Docker environment)');
} else {
  console.log('Using Neon serverless PostgreSQL client');
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add headers for CORS - especially important in Docker environments
app.use((req, res, next) => {
  // Get the origin header or default to '*'
  const origin = req.headers.origin || '*';
  
  // Allow requests from any origin in development/Docker
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Improved static file handling for Docker environment
app.get('/favicon.ico', (req, res) => {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'favicon.ico'),
    path.join(process.cwd(), 'client', 'public', 'favicon.ico'),
    path.join(process.cwd(), 'dist', 'public', 'favicon.ico')
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  
  res.status(404).send('Favicon not found');
});

// Custom config.js handler to ensure it's always available
app.get('/config.js', (req, res) => {
  // Try to find config.js in various locations
  const configPaths = [
    path.join(process.cwd(), 'dist', 'public', 'config.js'),
    path.join(process.cwd(), 'public', 'config.js'),
    path.join(process.cwd(), 'client', 'public', 'config.js'),
    path.join(process.cwd(), 'client', 'public', 'docker-config.js')
  ];
  
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      return res.sendFile(configPath);
    }
  }
  
  // If no config file found, generate a minimal one
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`// Generated fallback config.js
window.TRILOGY_CONFIG = {
  apiBaseUrl: '',
  version: '1.0.0',
  features: {
    analytics: false,
    darkMode: false
  }
};
console.log('TRILOGY_CONFIG loaded successfully:', window.TRILOGY_CONFIG);`);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

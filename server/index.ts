import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";
import { setupHealthChecks } from "./healthcheck";
import fs from "fs";
import path from "path";

const app = express();

// Configure CORS origins based on environment
const configureOrigins = () => {
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS || '*';
  
  // Log the CORS configuration
  console.log(`Configuring CORS with origins: ${corsOrigins}`);
  
  if (corsOrigins === '*') {
    return true; // Allow all origins
  }
  
  if (process.env.NODE_ENV === 'production') {
    // Handle comma-separated list of domains
    if (corsOrigins.includes(',')) {
      return corsOrigins.split(',').map(origin => origin.trim());
    }
    return [corsOrigins, /\.replit\.app$/, /\.replit\.dev$/];
  }
  
  return true; // Default to all origins in development
};

// Enable properly configured CORS with session credentials
app.use(cors({
  origin: configureOrigins(),
  credentials: true, // Critical for cookies/sessions to work cross-domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Set-Cookie'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Configure Express with higher payload limits
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: false, limit: '500mb' }));

// Determine the uploads directory based on environment
const isRestrictedFilesystem = process.env.RESTRICTED_FILESYSTEM === 'true';
const uploadsPath = isRestrictedFilesystem ? '/tmp/uploads' : 'uploads';

// Serve the uploads directory statically with specific cache control
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d', // Cache for one day
  setHeaders: (res, path) => {
    // Add cache control headers but prevent caching of videos for better streaming control
    if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Add a fallback route for uploads if the primary location fails
if (isRestrictedFilesystem) {
  console.log('Using fallback static file serving for restricted filesystem');
  app.use('/uploads', (req, res, next) => {
    // This is a fallback handler in case the main static middleware fails
    // It will only be reached if the file wasn't found in the primary location
    const fallbackPath = req.path.startsWith('/') ? req.path.substring(1) : req.path;
    const fullPath = path.join('/tmp/uploads', fallbackPath);
    
    if (fs.existsSync(fullPath)) {
      res.sendFile(fullPath);
    } else {
      next();
    }
  });
}

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
  // Set up health check endpoints before other routes
  setupHealthChecks(app);
  
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

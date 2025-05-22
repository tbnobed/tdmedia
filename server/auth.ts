import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

declare global {
  namespace Express {
    // Define an interface for the user object in Passport sessions
    interface User {
      id: number;
      username: string;
      email: string;
      password?: string;
      isAdmin: boolean;
      createdAt?: Date;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  // Support for bcrypt format (starts with $2b$)
  if (stored.startsWith('$2b$')) {
    return new Promise((resolve) => {
      bcrypt.compare(supplied, stored, (err, result) => {
        if (err) {
          console.error('Bcrypt compare error:', err);
          resolve(false);
        } else {
          resolve(result);
        }
      });
    });
  }
  
  // Original scrypt comparison
  try {
    const [hashed, salt] = stored.split(".");
    // If either part is missing, authentication fails
    if (!hashed || !salt) return false;
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Print diagnostic information about environment
  console.log(`Setting up authentication in ${process.env.NODE_ENV || 'development'} environment`);
  console.log(`Session secret exists: ${!!process.env.SESSION_SECRET}`);
  
  // Strong, proper session configuration
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "secure-media-cms-secret",
    resave: false, 
    saveUninitialized: false,
    store: storage.sessionStore,
    name: 'trilogyMedia.sid', // Named cookie helps identify our app's session
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true, 
      // Secure in production, but allow non-secure cookies in development
      secure: process.env.NODE_ENV === "production" ? true : false,
      sameSite: "lax"
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid email or password" });
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log('Login attempt for email:', req.body.email);
    
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      
      if (!user) {
        console.log('Authentication failed:', info?.message || 'Invalid credentials');
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, (loginErr: Error | null) => {
        if (loginErr) {
          console.error('Session establishment error:', loginErr);
          return next(loginErr);
        }
        
        console.log('Login successful for user ID:', user.id);
        
        // Force session save to ensure it's stored before responding
        req.session.save((saveErr: Error | null) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return next(saveErr);
          }
          
          return res.status(200).json(user);
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

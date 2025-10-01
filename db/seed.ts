import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";
import { users, playlists, media } from "@shared/schema";
import { hashPassword } from "../server/auth";
import ws from 'ws';

// This is required for the Neon serverless driver
neonConfig.webSocketConstructor = ws;

async function seed() {
  try {
    console.log("Seeding database...");
    
    // Create a connection pool
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set");
    }
    
    // Create a new connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    
    // Check if admin user exists
    const adminExists = await db.query.users.findFirst({
      where: (user, { eq }) => eq(user.username, "admin")
    });
    
    if (!adminExists) {
      console.log("Creating admin user...");
      await db.insert(users).values({
        username: "admin",
        email: "admin@example.com",
        password: await hashPassword("adminpassword"),
        isAdmin: true
      });
      console.log("Admin user created successfully!");
    } else {
      console.log("Admin user already exists, skipping...");
    }
    
    // Add demo user
    const demoUserExists = await db.query.users.findFirst({
      where: (user, { eq }) => eq(user.username, "demo")
    });
    
    if (!demoUserExists) {
      console.log("Creating demo user...");
      await db.insert(users).values({
        username: "demo",
        email: "client@example.com",
        password: await hashPassword("demopassword"),
        isAdmin: false
      });
      console.log("Demo user created successfully!");
    } else {
      console.log("Demo user already exists, skipping...");
    }
    
    // Add playlists if they don't exist
    const playlistNames = ["Presentations", "Videos", "Documents", "Images"];
    
    for (const name of playlistNames) {
      const playlistExists = await db.query.playlists.findFirst({
        where: (playlist, { eq }) => eq(playlist.name, name)
      });
      
      if (!playlistExists) {
        console.log(`Creating playlist: ${name}`);
        await db.insert(playlists).values({
          name,
          description: `${name} collection`
        });
      }
    }
    
    // Add demo media items if they don't exist (without playlist association)
    const demoMedia = [
      {
        title: "Product Demo Video",
        description: "Product demonstration highlighting key features and benefits.",
        type: "video" as const,
        fileUrl: "/media/product-demo.mp4",
        thumbnailUrl: "https://images.unsplash.com/photo-1576267423048-15c0040fec78?auto=format&fit=crop&w=800&q=80",
        duration: "5:32"
      },
      {
        title: "Technical Documentation",
        description: "Detailed technical specifications and implementation guides.",
        type: "document" as const,
        fileUrl: "/media/technical-doc.pdf",
        thumbnailUrl: "https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?auto=format&fit=crop&w=800&q=80",
        size: "23 pages"
      },
      {
        title: "Marketing Presentation",
        description: "Comprehensive overview of marketing strategy and results.",
        type: "presentation" as const,
        fileUrl: "/media/marketing-presentation.pptx",
        thumbnailUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
        size: "18 slides"
      },
      {
        title: "Training Workshop",
        description: "Comprehensive training session for advanced features.",
        type: "video" as const,
        fileUrl: "/media/training-workshop.mp4",
        thumbnailUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80",
        duration: "25:47"
      },
      {
        title: "Product Showcase",
        description: "High-resolution product photography for marketing.",
        type: "image" as const,
        fileUrl: "/media/product-showcase.jpg",
        thumbnailUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80",
        size: "High Res"
      },
      {
        title: "Strategy Document",
        description: "Strategic planning document outlining business objectives.",
        type: "document" as const,
        fileUrl: "/media/strategy-document.pdf",
        thumbnailUrl: "https://images.unsplash.com/photo-1512758017271-d7b84c2113f1?auto=format&fit=crop&w=800&q=80",
        size: "15 pages"
      }
    ];
    
    // Check if we have media items
    const mediaExists = await db.query.media.findFirst();
    
    if (!mediaExists) {
      console.log("Adding demo media items...");
      for (const item of demoMedia) {
        await db.insert(media).values(item);
      }
      console.log("Demo media items created successfully!");
    } else {
      console.log("Media items already exist, skipping...");
    }
    
    console.log("Database seeding completed successfully!");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();

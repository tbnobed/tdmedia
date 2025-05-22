import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { users, playlists, media, mediaPlaylists } from "@shared/schema";
import { hashPassword } from "../server/auth";

// Specify enum types for media
type MediaType = "video" | "document" | "image" | "presentation";

async function seed() {
  try {
    console.log("Seeding database...");
    
    // Create a connection pool
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set");
    }
    
    // Create a new connection
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    
    // Check if admin user exists
    const adminExists = await db.query.users.findFirst({
      where: (user, { eq }) => eq(user.username, "admin@obedtv.com")
    });
    
    if (!adminExists) {
      console.log("Creating admin user...");
      await db.insert(users).values({
        username: "admin@obedtv.com",
        email: "admin@obedtv.com",
        password: await hashPassword("adminpassword"),
        isAdmin: true
      });
    }
    
    // Add demo user
    const demoUserExists = await db.query.users.findFirst({
      where: (user, { eq }) => eq(user.username, "client@obedtv.com")
    });
    
    if (!demoUserExists) {
      console.log("Creating demo user...");
      await db.insert(users).values({
        username: "client@obedtv.com",
        email: "client@obedtv.com",
        password: await hashPassword("demopassword"),
        isAdmin: false
      });
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
    
    // Get created playlists
    const playlistList = await db.query.playlists.findMany();
    const playlistMap = playlistList.reduce((map, playlist) => {
      map[playlist.name] = playlist.id;
      return map;
    }, {} as Record<string, number>);
    
    // Add demo media items if they don't exist
    const demoMedia = [
      {
        title: "Product Demo Video",
        description: "Product demonstration highlighting key features and benefits.",
        type: "video" as MediaType,
        fileUrl: "/media/product-demo.mp4",
        thumbnailUrl: "https://images.unsplash.com/photo-1576267423048-15c0040fec78?auto=format&fit=crop&w=800&q=80",
        duration: "5:32",
        isActive: true
      },
      {
        title: "Technical Documentation",
        description: "Detailed technical specifications and implementation guides.",
        type: "document" as MediaType,
        fileUrl: "/media/technical-doc.pdf",
        thumbnailUrl: "https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?auto=format&fit=crop&w=800&q=80",
        size: "23 pages",
        isActive: true
      },
      {
        title: "Marketing Presentation",
        description: "Comprehensive overview of marketing strategy and results.",
        type: "presentation" as MediaType,
        fileUrl: "/media/marketing-presentation.pptx",
        thumbnailUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
        size: "18 slides",
        isActive: true
      },
      {
        title: "Training Workshop",
        description: "Comprehensive training session for advanced features.",
        type: "video" as MediaType,
        fileUrl: "/media/training-workshop.mp4",
        thumbnailUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80",
        duration: "25:47",
        isActive: true
      },
      {
        title: "Product Showcase",
        description: "High-resolution product photography for marketing.",
        type: "image" as MediaType,
        fileUrl: "/media/product-showcase.jpg",
        thumbnailUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80",
        size: "High Res",
        isActive: true
      },
      {
        title: "Strategy Document",
        description: "Strategic planning document outlining business objectives.",
        type: "document" as MediaType,
        fileUrl: "/media/strategy-document.pdf",
        thumbnailUrl: "https://images.unsplash.com/photo-1512758017271-d7b84c2113f1?auto=format&fit=crop&w=800&q=80",
        size: "15 pages",
        isActive: true
      }
    ];
    
    // Check if we have media items
    const mediaExists = await db.query.media.findFirst();
    
    if (!mediaExists) {
      console.log("Adding demo media items...");
      for (const item of demoMedia) {
        // Insert the media item
        const [newMedia] = await db.insert(media).values({
          title: item.title,
          description: item.description,
          type: item.type,
          fileUrl: item.fileUrl,
          thumbnailUrl: item.thumbnailUrl,
          duration: 'duration' in item ? item.duration : undefined,
          size: 'size' in item ? item.size : undefined,
          isActive: item.isActive
        }).returning();
        
        // Associate with appropriate playlist based on type
        let playlistId;
        if (item.type === 'video') {
          playlistId = playlistMap["Videos"];
        } else if (item.type === 'document') {
          playlistId = playlistMap["Documents"];
        } else if (item.type === 'presentation') {
          playlistId = playlistMap["Presentations"];
        } else if (item.type === 'image') {
          playlistId = playlistMap["Images"];
        }
        
        if (playlistId && newMedia.id) {
          await db.insert(mediaPlaylists).values({
            media_id: newMedia.id,
            playlist_id: playlistId
          });
        }
      }
    }
    
    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();

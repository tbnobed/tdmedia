import { db } from "../db";
import { users } from "../shared/schema";
import { hashPassword } from "../server/auth";

async function createClient() {
  try {
    console.log("Creating client user...");
    
    // Check if client already exists
    const existingClient = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, "client@example.com")
    });
    
    if (existingClient) {
      console.log("Client user already exists!");
      process.exit(0);
    }
    
    // Create client user
    const hashedPassword = await hashPassword("demopassword");
    
    const [client] = await db.insert(users).values({
      username: "client",
      email: "client@example.com",
      password: hashedPassword,
      isAdmin: false
    }).returning();
    
    console.log("Client user created successfully!");
    console.log("Email: client@example.com");
    console.log("Password: demopassword");
    
  } catch (error) {
    console.error("Error creating client user:", error);
  } finally {
    process.exit(0);
  }
}

createClient();
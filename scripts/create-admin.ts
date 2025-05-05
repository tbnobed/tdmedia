import { db } from "../db";
import { users } from "../shared/schema";
import { hashPassword } from "../server/auth";

async function createAdmin() {
  try {
    console.log("Creating admin user...");
    
    // Check if admin already exists
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, "admin@example.com")
    });
    
    if (existingAdmin) {
      console.log("Admin user already exists!");
      process.exit(0);
    }
    
    // Create admin user
    const hashedPassword = await hashPassword("adminpassword");
    
    const [admin] = await db.insert(users).values({
      username: "admin",
      email: "admin@example.com",
      password: hashedPassword,
      isAdmin: true
    }).returning();
    
    console.log("Admin user created successfully!");
    console.log("Email: admin@example.com");
    console.log("Password: adminpassword");
    
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    process.exit(0);
  }
}

createAdmin();
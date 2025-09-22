import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import User from "../../models/user.js";

describe("Auth API", () => {
  beforeAll(async () => {
    const mongoUrl = process.env.MONGODB_URL || process.env.MONGO_URI;
    if (!mongoUrl) {
      throw new Error('MongoDB URL not found in environment variables');
    }
    
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUrl);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("User Registration", () => {
    test("should register a new user successfully", async () => {
      const userData = {
        name: "Test User",
        email: `testuser-${Date.now()}@example.com`,
        password: "StrongP@ss1",
      };

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(userData);

      expect(res.statusCode).toBe(201);
      expect(res.body.user.email).toBe(userData.email);
      expect(res.body.user.name).toBe(userData.name);
      expect(res.body.user).not.toHaveProperty("password");
    });

    test("should not register user with weak password", async () => {
      const userData = {
        name: "Test User",
        email: `testuser-${Date.now()}@example.com`,
        password: "weak",
      };

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(userData);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/password/i);
    });
  });

  describe("User Login", () => {
    test("should login registered user", async () => {
      const userData = {
        name: "Login User",
        email: `loginuser-${Date.now()}@example.com`,
        password: "StrongP@ss1",
      };

      // Register user 
      await request(app)
        .post("/api/v1/auth/register")
        .send(userData);

      // login
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(userData.email);
    });

    test("should not login with wrong password", async () => {
      const userData = {
        name: "Wrong Pass User",
        email: `wrongpass-${Date.now()}@example.com`,
        password: "StrongP@ss1",
      };

      // Register user first
      await request(app)
        .post("/api/v1/auth/register")
        .send(userData);

      // Try login with wrong password
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: userData.email,
          password: "WrongPassword",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/invalid/i);
    });

    test("should lock account after failed login attempts", async () => {
      const userData = {
        name: "Lock User",
        email: `lockuser-${Date.now()}@example.com`,
        password: "StrongP@ss1",
      };

      // Register user first
      await request(app)
        .post("/api/v1/auth/register")
        .send(userData);

      // Make 3 failed login attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/api/v1/auth/login")
          .send({
            email: userData.email,
            password: "WrongPassword",
          });
      }

      // Try to login with correct password (Acct should be locked)
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/locked/i);
    });
  });

  describe("Profile Management", () => {
    test("should update user profile", async () => {
      const userData = {
        name: "Profile User",
        email: `profileuser-${Date.now()}@example.com`,
        password: "StrongP@ss1",
      };

      // Register and login
      await request(app).post("/api/v1/auth/register").send(userData);
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: userData.email, password: userData.password });

      const token = loginRes.body.accessToken;

      // Update profile
      const res = await request(app)
        .patch("/api/v1/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Name" });

      expect(res.statusCode).toBe(200);
      expect(res.body.user.name).toBe("Updated Name");
    });

    test("should delete user account", async () => {
      const userData = {
        name: "Delete User",
        email: `deleteuser-${Date.now()}@example.com`,
        password: "StrongP@ss1",
      };

      // Register and login
      await request(app).post("/api/v1/auth/register").send(userData);
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: userData.email, password: userData.password });

      const token = loginRes.body.accessToken;

      // Delete account
      const res = await request(app)
        .delete("/api/v1/auth/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);

      // Verify user can no longer login
      const loginAttempt = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: userData.email, password: userData.password });

      expect(loginAttempt.statusCode).toBe(400);
    });
  });
});
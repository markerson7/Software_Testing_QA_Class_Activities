import { jest } from '@jest/globals';
import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import User from "../../models/user.js";

describe("Middleware Tests", () => {
  beforeAll(async () => {
    const mongoUrl = process.env.MONGODB_URL;
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

  describe("Authentication Middleware", () => {
    test("should reject request without Authorization header", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .send({ text: "Test todo" });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toMatch(/access denied/i);
    });

    test("should reject request with malformed Authorization header", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", "InvalidFormat token")
        .send({ text: "Test todo" });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toMatch(/access denied/i);
    });

    test("should reject request with invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", "Bearer invalid.jwt.token")
        .send({ text: "Test todo" });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toMatch(/invalid token/i);
    });

    test("should reject request when user not found", async () => {
      const userData = {
        name: "Temp User",
        email: `temp-${Date.now()}@example.com`,
        password: "StrongP@ss1",
      };

      await request(app).post("/api/v1/auth/register").send(userData);
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: userData.email, password: userData.password });

      const token = loginRes.body.accessToken;

      await User.deleteOne({ email: userData.email });

      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Test todo" });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe("Role Authorization Middleware", () => {
    let userToken, managerToken, adminToken;

    beforeEach(async () => {
      const timestamp = Date.now();
      const testSuffix = Math.random().toString(36).substring(7);

      // Create users with different roles
      const [user, manager, admin] = await Promise.all([
        User.create({
          name: "User",
          email: `user-${timestamp}-${testSuffix}@test.com`,
          password: "StrongP@ss1",
          role: "User"
        }),
        User.create({
          name: "Manager",
          email: `manager-${timestamp}-${testSuffix}@test.com`,
          password: "StrongP@ss1",
          role: "Manager"
        }),
        User.create({
          name: "Admin",
          email: `admin-${timestamp}-${testSuffix}@test.com`,
          password: "StrongP@ss1",
          role: "Admin"
        })
      ]);

      // Get tokens
      const [userLogin, managerLogin, adminLogin] = await Promise.all([
        request(app).post("/api/v1/auth/login").send({
          email: user.email, password: "StrongP@ss1"
        }),
        request(app).post("/api/v1/auth/login").send({
          email: manager.email, password: "StrongP@ss1"
        }),
        request(app).post("/api/v1/auth/login").send({
          email: admin.email, password: "StrongP@ss1"
        })
      ]);

      userToken = userLogin.body.accessToken;
      managerToken = managerLogin.body.accessToken;
      adminToken = adminLogin.body.accessToken;
    });

    test("should allow User role to access user endpoints", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ text: "User todo" });

      expect(res.statusCode).toBe(201);
    });

    test("should allow Manager role to access manager endpoints", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ text: "Manager todo" });

      expect(res.statusCode).toBe(201);
    });

    test("should deny User access to Manager endpoints", async () => {
      const todoId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .post(`/api/v1/todos/${todoId}/assign`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ assignedTo: userId });

      expect(res.statusCode).toBe(403);
    });

    test("should handle unauthenticated request to protected endpoint", async () => {
      const res = await request(app)
        .delete("/api/v1/todos/bulk")
        .send({ ids: [new mongoose.Types.ObjectId()] });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("Validation Middleware", () => {
    let userToken;

    beforeEach(async () => {
      const userData = {
        name: "Test User",
        email: `testuser-${Date.now()}@example.com`,
        password: "StrongP@ss1",
      };

      await request(app).post("/api/v1/auth/register").send(userData);
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: userData.email, password: userData.password });

      userToken = loginRes.body.accessToken;
    });

    test("should validate todo text is required", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/text is required/i);
    });

    test("should validate todo text is not empty", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ text: "   " });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/text is required/i);
    });

    test("should validate todo text length", async () => {
      const longText = "a".repeat(201);
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ text: longText });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/200 characters/i);
    });

    test("should validate MongoDB ObjectId format", async () => {
      const res = await request(app)
        .delete("/api/v1/todos/invalid-id")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/invalid id format/i);
    });

    test("should validate bulk operation IDs", async () => {
      const res = await request(app)
        .delete("/api/v1/todos/bulk")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ ids: ["invalid-id"] });

      expect(res.statusCode).toBe(400);
    });

  });

  describe("Error Handling Middleware", () => {
    test("should handle 404 for non-existent routes", async () => {
      const res = await request(app)
        .get("/api/v1/nonexistent");

      expect(res.statusCode).toBe(404);
    });

    test("should handle server errors gracefully", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ invalid: "data" });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBeDefined();
    });
  });

});
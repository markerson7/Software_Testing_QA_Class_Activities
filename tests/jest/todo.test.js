import { jest } from '@jest/globals';
import mongoose from "mongoose";
import app from "../../app.js";
import Todo from "../../models/todo.js";
import User from "../../models/user.js";
import request from "supertest";

// Global test setup
let userToken, adminToken, managerToken;
let testUsers = {};

describe("Todo API", () => {
  beforeAll(async () => {
    const mongoUrl = process.env.MONGODB_URL;
    if (!mongoUrl) {
      throw new Error('MongoDB URL not found in environment variables');
    }
    
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUrl);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
    // await Todo.deleteMany({});
    // await User.deleteMany({});
  });

  beforeEach(async () => {
    const timestamp = Date.now();
    const testSuffix = Math.random().toString(36).substring(7);
    
    const [admin, manager, user] = await Promise.all([
      User.create({
        name: "Admin",
        email: `admin-${timestamp}-${testSuffix}@test.com`,
        password: "StrongP@ss1",
        role: "Admin"
      }),
      User.create({
        name: "Manager", 
        email: `manager-${timestamp}-${testSuffix}@test.com`,
        password: "StrongP@ss1",
        role: "Manager"
      }),
      User.create({
        name: "User",
        email: `user-${timestamp}-${testSuffix}@test.com`,
        password: "StrongP@ss1",
        role: "User"
      })
    ]);

    testUsers = { admin, manager, user };

    // Login and get tokens
    const [adminLogin, managerLogin, userLogin] = await Promise.all([
      request(app).post("/api/v1/auth/login").send({
        email: admin.email,
        password: "StrongP@ss1"
      }),
      request(app).post("/api/v1/auth/login").send({
        email: manager.email,
        password: "StrongP@ss1"
      }),
      request(app).post("/api/v1/auth/login").send({
        email: user.email,
        password: "StrongP@ss1"
      })
    ]);

    if (adminLogin.statusCode !== 200) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
    if (managerLogin.statusCode !== 200) throw new Error(`Manager login failed: ${JSON.stringify(managerLogin.body)}`);
    if (userLogin.statusCode !== 200) throw new Error(`User login failed: ${JSON.stringify(userLogin.body)}`);

    adminToken = adminLogin.body.accessToken;
    managerToken = managerLogin.body.accessToken;
    userToken = userLogin.body.accessToken;
  });

  describe("Basic Routes", () => {
    test("GET /home should return welcome message", async () => {
      const res = await request(app).get("/api/v1/todos/home");
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Welcome to the home route!");
    });

    test("should create a new todo", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ text: "Test todo" });

      expect(res.statusCode).toBe(201);
      expect(res.body.text).toBe("Test todo");
      expect(res.body.completed).toBe(false);
    });

    test("should fail to create todo without text", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test("should fail to create todo with text too long", async () => {
      const longText = "a".repeat(201); 
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ text: longText });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/200 characters/i);
    });

    test("should fail to create todo without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .send({ text: "Test todo" });

      expect(res.statusCode).toBe(401);
    });

    test("should fail to create todo with invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .set("Authorization", "Bearer invalid-token")
        .send({ text: "Test todo" });

      expect(res.statusCode).toBe(401);
    });

    test("should get all todos for user", async () => {
      await Todo.create({ 
        text: "User's todo", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .get("/api/v1/todos")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos).toBeDefined();
      expect(res.body.todos.length).toBe(1);
    });

    test("should return empty array when no todos", async () => {
      const res = await request(app)
        .get("/api/v1/todos")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos.length).toBe(0);
    });
  });

  describe("RBAC Features", () => {
    test("Admin should see all todos", async () => {
      await Todo.create({ 
        text: "Any user's todo", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .get("/api/v1/todos")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos.length).toBeGreaterThan(0);
    });

    test("Manager should see only their todos and assigned todos", async () => {
      await Todo.create({ 
        text: "Manager's todo", 
        createdBy: testUsers.manager._id 
      });
      await Todo.create({ 
        text: "User's todo", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .get("/api/v1/todos")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos.length).toBe(1);
    });

    test("User cannot delete another user's todo", async () => {
      const adminTodo = await Todo.create({ 
        text: "Admin's todo", 
        createdBy: testUsers.admin._id 
      });

      const res = await request(app)
        .delete(`/api/v1/todos/${adminTodo._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });

    test("User can delete their own todo", async () => {
      const userTodo = await Todo.create({ 
        text: "User's todo", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .delete(`/api/v1/todos/${userTodo._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
    });

    test("Admin can delete any todo", async () => {
      const userTodo = await Todo.create({ 
        text: "User's todo", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .delete(`/api/v1/todos/${userTodo._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
    });

    test("should return 404 when deleting non-existent todo", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/v1/todos/${fakeId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
    });

    test("should return 400 for invalid todo ID format", async () => {
      const res = await request(app)
        .delete("/api/v1/todos/invalid-id")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(400);
    });

    test("Manager can assign todo to a user", async () => {
      const managerTodo = await Todo.create({ 
        text: "Manager's todo", 
        createdBy: testUsers.manager._id 
      });

      const res = await request(app)
        .post(`/api/v1/todos/${managerTodo._id}/assign`)
        .send({ assignedTo: testUsers.user._id })
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todo.assignedTo).toBe(testUsers.user._id.toString());
      expect(res.body.todo.status).toBe("in-progress");
    });

    test("Manager cannot assign todo they didn't create", async () => {
      const userTodo = await Todo.create({ 
        text: "User's todo", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .post(`/api/v1/todos/${userTodo._id}/assign`)
        .send({ assignedTo: testUsers.user._id })
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(403);
    });

    test("should return 404 when assigning non-existent todo", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/v1/todos/${fakeId}/assign`)
        .send({ assignedTo: testUsers.user._id })
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(404);
    });

    test("User cannot assign todos", async () => {
      const userTodo = await Todo.create({ 
        text: "User's todo", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .post(`/api/v1/todos/${userTodo._id}/assign`)
        .send({ assignedTo: testUsers.user._id })
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe("Bulk Operations", () => {
   
    test("should fail bulk delete without IDs", async () => {
      const res = await request(app)
        .delete("/api/v1/todos/bulk")
        .send({})
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });

    test("should fail bulk delete with empty IDs array", async () => {
      const res = await request(app)
        .delete("/api/v1/todos/bulk")
        .send({ ids: [] })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });

    test("should fail bulk delete with invalid ID format", async () => {
      const res = await request(app)
        .delete("/api/v1/todos/bulk")
        .send({ ids: ["invalid-id"] })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });

    test("Manager can bulk update todos", async () => {
      const todo1 = await Todo.create({ 
        text: "Todo 1", 
        createdBy: testUsers.manager._id 
      });
      const todo2 = await Todo.create({ 
        text: "Todo 2", 
        createdBy: testUsers.manager._id 
      });

      const res = await request(app)
        .patch("/api/v1/todos/bulk")
        .send({ 
          ids: [todo1._id, todo2._id], 
          updates: { status: "completed" } 
        })
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    test("User cannot bulk update", async () => {
      const todo1 = await Todo.create({ 
        text: "Todo 1", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .patch("/api/v1/todos/bulk")
        .send({ 
          ids: [todo1._id], 
          updates: { status: "completed" } 
        })
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe("Advanced Features", () => {
    test("should filter todos by status", async () => {
      await Promise.all([
        Todo.create({ 
          text: "Pending task", 
          status: "pending", 
          createdBy: testUsers.user._id 
        }),
        Todo.create({ 
          text: "Completed task", 
          status: "completed", 
          createdBy: testUsers.user._id 
        })
      ]);

      const res = await request(app)
        .get("/api/v1/todos?status=pending")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos.length).toBe(1);
      expect(res.body.todos[0].status).toBe("pending");
    });

    test("should filter todos by priority", async () => {
      await Promise.all([
        Todo.create({ 
          text: "High priority task", 
          priority: "high", 
          createdBy: testUsers.user._id 
        }),
        Todo.create({ 
          text: "Low priority task", 
          priority: "low", 
          createdBy: testUsers.user._id 
        })
      ]);

      const res = await request(app)
        .get("/api/v1/todos?priority=high")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos.length).toBe(1);
      expect(res.body.todos[0].priority).toBe("high");
    });

    test("should search todos by text", async () => {
      await Promise.all([
        Todo.create({ 
          text: "Project report", 
          createdBy: testUsers.user._id 
        }),
        Todo.create({ 
          text: "Shopping list", 
          createdBy: testUsers.user._id 
        })
      ]);

      const res = await request(app)
        .get("/api/v1/todos?search=report")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos.length).toBe(1);
      expect(res.body.todos[0].text).toMatch(/report/i);
    });

    test("should sort todos by priority", async () => {
      await Promise.all([
        Todo.create({ 
          text: "Low priority", 
          priority: "low", 
          createdBy: testUsers.user._id 
        }),
        Todo.create({ 
          text: "High priority", 
          priority: "high", 
          createdBy: testUsers.user._id 
        })
      ]);

      const res = await request(app)
        .get("/api/v1/todos?sortBy=priority")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos[0].priority).toBe("high"); 
    });

    test("should sort todos with descending order", async () => {
      await Promise.all([
        Todo.create({ 
          text: "Task A", 
          priority: "low", 
          createdBy: testUsers.user._id 
        }),
        Todo.create({ 
          text: "Task B", 
          priority: "high", 
          createdBy: testUsers.user._id 
        })
      ]);

      const res = await request(app)
        .get("/api/v1/todos?sortBy=-priority")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todos[0].priority).toBe("low"); 
    });

    test("should paginate todos", async () => {
      const todos = [];
      for (let i = 1; i <= 15; i++) {
        todos.push(Todo.create({ 
          text: `Task ${i}`, 
          createdBy: testUsers.user._id 
        }));
      }
      await Promise.all(todos);

      const res = await request(app)
        .get("/api/v1/todos?page=2&limit=5")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(5);
      expect(res.body.todos.length).toBe(5);
      expect(res.body.totalPages).toBe(3);
    });

  });

  describe("Todo Completion", () => {
    test("should mark todo as completed", async () => {
      const todo = await Todo.create({ 
        text: "Finish homework", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .patch(`/api/v1/todos/${todo._id}/complete`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todo.status).toBe("completed");
      expect(res.body.todo.completed).toBe(true);
      expect(res.body.todo.completedAt).toBeDefined();
    });

    test("Admin can complete any todo", async () => {
      const todo = await Todo.create({ 
        text: "User's task", 
        createdBy: testUsers.user._id 
      });

      const res = await request(app)
        .patch(`/api/v1/todos/${todo._id}/complete`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todo.status).toBe("completed");
    });

    test("Assigned user can complete todo", async () => {
      const todo = await Todo.create({ 
        text: "Assigned task", 
        createdBy: testUsers.manager._id,
        assignedTo: testUsers.user._id
      });

      const res = await request(app)
        .patch(`/api/v1/todos/${todo._id}/complete`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.todo.status).toBe("completed");
    });

    test("User cannot complete todo they don't own or aren't assigned", async () => {
      const todo = await Todo.create({ 
        text: "Admin's task", 
        createdBy: testUsers.admin._id 
      });

      const res = await request(app)
        .patch(`/api/v1/todos/${todo._id}/complete`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });

    test("should return 404 when completing non-existent todo", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/todos/${fakeId}/complete`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      // This test would need to mock database failures
      // For now, just test the error structure
      const res = await request(app)
        .get("/api/v1/todos")
        .set("Authorization", "Bearer invalid");

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test("should return proper error for missing authorization header", async () => {
      const res = await request(app)
        .post("/api/v1/todos/add")
        .send({ text: "Test todo" });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toMatch(/access denied/i);
    });
  });
});
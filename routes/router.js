
import express from 'express';
import Todo from '../models/todo.js';
import { validateTodo, validateId, validateBulkIds } from '../middleware/validation.js';
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();



// GET /home
router.get("/home", async (req, res) => {
  res.status(200).json({ message: "Welcome to the home route!" });
});


// POST /add (User, Manager, Admin)
router.post(
  "/add",
  authenticate,
  authorizeRoles("User", "Manager", "Admin"),
  validateTodo,
  async (req, res) => {
    try {
      const todo = new Todo({
        text: req.body.text,
        description: req.body.description,
        status: req.body.status,
        priority: req.body.priority,
        createdBy: req.user._id, 
      });

      const savedTodo = await todo.save();
      res.status(201).json(savedTodo);
    } catch (error) {
      res.status(500).json({ error: "Failed to create todo" });
    }
  }
);



// GET /api/v1/todos (Advanced Query (filter, sort, paginate, search))
router.get("/", authenticate, async (req, res) => {
  try {
    const { status, priority, category, assignedTo, startDate, endDate, search, sortBy, page, limit } = req.query;

    let filter = {};
    if (req.user.role === "Admin") {
    } else if (req.user.role === "Manager") {
      filter.$or = [
        { createdBy: req.user._id },
        { assignedBy: req.user._id },
      ];
    } else {
      filter.createdBy = req.user._id;
    }

    // Filtering
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;

    if (startDate && endDate) {
      filter.dueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Search
    if (search) {
      filter.$or = [
        { text: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting
    let sortOptions = {};
    if (sortBy) {
      const sortFields = sortBy.split(","); 
      sortFields.forEach((field) => {
        if (field.startsWith("-")) {
          sortOptions[field.substring(1)] = -1;
        } else {
          sortOptions[field] = 1;
        }
      });
    } else {
      sortOptions.createdAt = -1; 
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const skip = (pageNum - 1) * pageSize;

    const todos = await Todo.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .populate("createdBy assignedTo assignedBy", "name email role");

    const total = await Todo.countDocuments(filter);

    res.json({
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      todos,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch todos" });
  }
});


// DELETE (Admin can delete any todo, Users only their own)
router.delete("/:id", authenticate, validateId, async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) return res.status(404).json({ error: "Todo not found" });

    if (
      req.user.role !== "Admin" &&
      todo.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this todo" });
    }

    await todo.deleteOne();
    res.json({ message: "Todo deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete todo" });
  }
});


// BULK DELETE (Admin only)
router.delete("/bulk", authenticate, authorizeRoles("Admin"), validateBulkIds, async (req, res) => {
  try {
    const { ids } = req.body; 
    const result = await Todo.deleteMany({ _id: { $in: ids } });
    res.json({ 
      message: `${result.deletedCount} todos deleted successfully`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to bulk delete todos" });
  }
});

// BULK UPDATE (Admin/Manager)
router.patch("/bulk", authenticate, authorizeRoles("Admin", "Manager"), async (req, res) => {
  try {
    const { ids, updates } = req.body;
    await Todo.updateMany({ _id: { $in: ids } }, updates, { multi: true });
    res.json({ message: "Todos updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to bulk update todos" });
  }
});


// ASSIGN todo (Manager or Admin)
router.post("/:id/assign", authenticate, authorizeRoles("Manager"), async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    const todo = await Todo.findById(id);
    if (!todo) return res.status(404).json({ error: "Todo not found" });

    // Managers can only assign todos they created
    if (req.user.role === "Manager" && todo.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to assign this todo" });
    }

    todo.assignedTo = assignedTo;
    todo.assignedBy = req.user._id;
    todo.status = "in-progress"; 

    //assignment history
    todo.assignmentHistory.push({
      assignedTo,
      assignedBy: req.user._id,
      assignedAt: new Date(),
    });

    await todo.save();

    res.json({
      message: "Todo assigned successfully",
      todo,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign todo" });
  }
});

// COMPLETE a todo
router.patch("/:id/complete", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const todo = await Todo.findById(id);

    if (!todo) return res.status(404).json({ error: "Todo not found" });

    // Only Admin or owner (or assigned user) can complete
    if (
      req.user.role !== "Admin" &&
      todo.createdBy.toString() !== req.user._id.toString() &&
      todo.assignedTo?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: "Not authorized to complete this todo" });
    }

    todo.status = "completed";
    todo.completed = true;
    todo.completedAt = new Date();
    await todo.save();

    res.json({ message: "Todo marked as completed", todo });
  } catch (error) {
    res.status(500).json({ error: "Failed to complete todo" });
  }
});



export default router;

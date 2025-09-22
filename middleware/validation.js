import mongoose from "mongoose";

export const validateTodo = (req, res, next) => {
  const { text } = req.body;
  
  if (!text || text.trim() === "") {
    return res.status(400).json({ error: "Text is required" });
  }

  if (text.length > 200) {
    return res.status(400).json({ error: "Text must be less than 200 characters" });
  }

  next();
};

export const validateId = (req, res, next) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  next();
};

export const validateBulkIds = (req, res, next) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "IDs array is required and must not be empty" });
  }

  const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    return res.status(400).json({ error: "Invalid ID format in bulk operation" });
  }

  next();
};
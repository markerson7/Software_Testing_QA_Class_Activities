import express from 'express';
import todoRoutes from './routes/router.js';
import connectDB from './database/database.js';
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import cors from 'cors';
import { errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  console.log("Mongo URL:", process.env.MONGODB_URL);
  connectDB();
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/todos', todoRoutes);
app.use("/api/v1/auth", authRoutes);

//error handling
app.use(errorHandler);

app.get('/', (req, res) => {
  res.json({
    message: 'Testing Environment ready',
    moduleType: 'ES modules',
    moduleVersion: process.version
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
});
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// This is a function to Generate tokens
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

// Register Route
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Password validation
    const strongPassword = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!strongPassword.test(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 chars, include uppercase, number, and special char",
      });
    }

   const userData = { name, email, password };
    if (role) {
      userData.role = role;
    }

    const user = await User.create(userData);
    const safeUser = { id: user._id, name: user.name, email: user.email, role: user.role };

    res.status(201).json({ message: "User registered successfully", user: safeUser });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login route 
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      return res
        .status(403)
        .json({ error: "Account locked. Try again later." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 3) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); 
        await user.save();
        return res
          .status(403)
          .json({ error: "Account locked due to failed attempts" });
      }

      await user.save();
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const safeUser = { id: user._id, name: user.name, email: user.email, role: user.role };
    res.json({ accessToken, refreshToken, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// get profile route
router.get("/profile", authenticate, async (req, res) => {
  const safeUser = { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role };
  res.json(safeUser);
});

// update profile info (name, email)
router.patch("/profile", authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;
    req.user.name = name || req.user.name;
    req.user.email = email || req.user.email;
    await req.user.save();

    const safeUser = { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role };
    res.json({ message: "Profile updated", user: safeUser });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// change password route
router.patch("/profile/password", authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const isMatch = await req.user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password incorrect" });
    }

    req.user.password = newPassword;
    await req.user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to change password" });
  }
});

// delete account
router.delete("/profile", authenticate, async (req, res) => {
  try {
    await req.user.deleteOne();
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;

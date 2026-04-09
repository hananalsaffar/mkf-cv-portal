const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const cvRoutes = require("./routes/cvRoutes");
const graduateRoutes = require("./routes/graduateRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

/*
 * Enables controlled cross-origin requests from the frontend
 * during local development.
 */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

/*
 * Parses incoming JSON request bodies.
 */
app.use(express.json());

/*
 * Applies secure HTTP response headers.
 */
app.use(helmet());

/*
 * Public health-check route for quick backend verification.
 */
app.get("/", (req, res) => {
  res.send("CLP Talent Portal API Running");
});

// Authentication routes
app.use("/api/auth", authRoutes);

// CV routes
app.use("/api/cv", cvRoutes);

// Graduate routes
app.use("/api/graduates", graduateRoutes);

// Admin routes
app.use("/api/admin", adminRoutes);

module.exports = app;
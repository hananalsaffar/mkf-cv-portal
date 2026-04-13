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
 * Public health-check route
 */
app.get("/", (req, res) => {
  res.send("CLP Talent Portal API Running");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cv", cvRoutes);
app.use("/api/graduates", graduateRoutes);
app.use("/api/admin", adminRoutes);

/*
 * Global error handler (MUST be before export)
 */
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal server error"
  });
});

module.exports = app;
// Routes related to authentication (login)
const express = require("express");
const router = express.Router();

const { login } = require("../controllers/authController");
const { loginRateLimiter } = require("../middleware/rateLimitMiddleware");

// Apply rate limiting to prevent brute-force login attempts
router.post("/login", loginRateLimiter, login);

module.exports = router;
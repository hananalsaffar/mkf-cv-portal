const rateLimit = require("express-rate-limit");

// Limit repeated login attempts to reduce brute-force attacks.
const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 requests per window
  message: {
    message: "Too many login attempts. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  loginRateLimiter
};
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logAction = require("../utils/auditLogger");

// Handle user login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const [users] = await db.promise().query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    // Return a generic message to avoid revealing whether the email exists
    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];

    // Block inactive accounts
    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is inactive" });
    }

    // Block login if the account is temporarily locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        message: "Account is temporarily locked. Please try again later."
      });
    }

    // Compare entered password with stored hash
    const match = await bcrypt.compare(password, user.password_hash);

    // Handle failed login attempt
    if (!match) {
      const failedAttempts = user.failed_login_attempts + 1;

      // Lock the account for 15 minutes after 5 failed attempts
      if (failedAttempts >= 5) {
        await db.promise().query(
          `UPDATE users
           SET failed_login_attempts = 0,
               locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
           WHERE id = ?`,
          [user.id]
        );

        return res.status(423).json({
          message: "Account locked after multiple failed attempts. Try again later."
        });
      }

      // Update failed login counter
      await db.promise().query(
        `UPDATE users
         SET failed_login_attempts = ?
         WHERE id = ?`,
        [failedAttempts, user.id]
      );

      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Reset failed attempts and lock status after successful login
    await db.promise().query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = ?`,
      [user.id]
    );

    // Log successful login
    await logAction(user.id, "USER_LOGIN");

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Return token and essential user details for frontend session handling
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
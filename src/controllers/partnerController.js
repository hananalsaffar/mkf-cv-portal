const db = require("../config/db");
const bcrypt = require("bcrypt");
const logAction = require("../utils/auditLogger");

// Create a new partner account
exports.createPartner = async (req, res) => {
  try {
    const { full_name, email, password, organization_name } = req.body;

    // Validate required fields
    if (!full_name || !email || !password || !organization_name) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email already exists
    const [existingUsers] = await db.promise().query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Hash password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new partner account
    const [result] = await db.promise().query(
      `INSERT INTO users (full_name, organization_name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'partner', 'active')`,
      [full_name, organization_name, email, hashedPassword]
    );

    // Log the partner creation action
    await logAction(req.user.id, "PARTNER_CREATED", "user", result.insertId);

    return res.status(201).json({
      message: "Partner account created successfully"
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get all partner accounts
exports.getPartners = async (req, res) => {
  try {
    const [partners] = await db.promise().query(
      `SELECT id, full_name, organization_name, email, role, status, created_at
       FROM users
       WHERE role = 'partner'
       ORDER BY created_at DESC`
    );

    return res.json(partners);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Activate or deactivate a partner account
exports.updatePartnerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Only allow valid status values
    if (status !== "active" && status !== "inactive") {
      return res.status(400).json({
        message: "Status must be active or inactive"
      });
    }

    const [result] = await db.promise().query(
      "UPDATE users SET status = ? WHERE id = ? AND role = 'partner'",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Partner account not found" });
    }

    // Log activation or deactivation action
    const action =
      status === "active" ? "PARTNER_ACTIVATED" : "PARTNER_DEACTIVATED";

    await logAction(req.user.id, action, "user", id);

    return res.json({
      message: `Partner account ${status} successfully`
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Reset a partner account password
exports.resetPartnerPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({ message: "New password is required" });
    }

    // Hash the new password before updating
    const hashedPassword = await bcrypt.hash(new_password, 10);

    const [result] = await db.promise().query(
      `UPDATE users
       SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL
       WHERE id = ? AND role = 'partner'`,
      [hashedPassword, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Partner account not found" });
    }

    // Log password reset action
    await logAction(req.user.id, "PARTNER_PASSWORD_RESET", "user", id);

    return res.json({
      message: "Partner password reset successfully"
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
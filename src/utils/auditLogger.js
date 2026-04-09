const db = require("../config/db");

// Save important system actions in audit_logs table
async function logAction(userId, action, targetType = null, targetId = null) {
  try {
    await db.promise().query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id)
       VALUES (?, ?, ?, ?)`,
      [userId, action, targetType, targetId]
    );
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
}

module.exports = logAction;
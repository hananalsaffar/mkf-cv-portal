const db = require("../config/db");
const logAction = require("../utils/auditLogger");

// Create graduate profile
exports.createGraduate = async (req, res) => {
  try {
    const { full_name, major, graduation_year, skills } = req.body;

    if (!full_name) {
      return res.status(400).json({ message: "full_name is required" });
    }

    const [result] = await db.promise().query(
      `INSERT INTO graduates (full_name, major, graduation_year, skills)
       VALUES (?, ?, ?, ?)`,
      [full_name, major, graduation_year, skills]
    );

    // Record graduate creation for accountability
    await logAction(req.user.id, "GRADUATE_CREATED", "graduate", result.insertId);

    res.status(201).json({
      message: "Graduate created successfully",
      graduate_id: result.insertId
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update graduate profile
exports.updateGraduate = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, major, graduation_year, skills } = req.body;

    const [result] = await db.promise().query(
      `UPDATE graduates
       SET full_name = ?, major = ?, graduation_year = ?, skills = ?
       WHERE id = ?`,
      [full_name, major, graduation_year, skills, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Graduate not found" });
    }

    // Record graduate update for accountability
    await logAction(req.user.id, "GRADUATE_UPDATED", "graduate", id);     

    res.json({
      message: "Graduate updated successfully"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Publish or unpublish graduate profile
exports.setGraduatePublishStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_published } = req.body;

    const [result] = await db.promise().query(
      `UPDATE graduates
       SET is_published = ?
       WHERE id = ?`,
      [is_published, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Graduate not found" });
    }

    await logAction(req.user.id, "GRADUATE_PUBLISH_STATUS", "graduate", id);

    res.json({
      message: "Graduate publish status updated successfully"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get graduates with optional filters
exports.getPublishedGraduates = async (req, res) => {
  try {
    const { major, graduation_year, skills } = req.query;

    let query = `SELECT * FROM graduates`;
    const conditions = [];
    const values = [];

    // Partners should only see published graduates
    if (req.user.role === "partner") {
      conditions.push(`is_published = true`);
    }

    // Allow partial major search
    if (major) {
      conditions.push(`major LIKE ?`);
      values.push(`%${major}%`);
    }

    // Keep graduation year exact
    if (graduation_year) {
      conditions.push(`graduation_year = ?`);
      values.push(graduation_year);
    }

    // Allow partial skills search
    if (skills) {
      conditions.push(`skills LIKE ?`);
      values.push(`%${skills}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(` AND `);
    }

    const [rows] = await db.promise().query(query, values);

    res.json(rows);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single graduate by ID
exports.getGraduateById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.promise().query(
      `SELECT * FROM graduates WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Graduate not found" });
    }

    const graduate = rows[0];

    // Restrict partner access to published graduate records only.
    if (req.user.role === "partner" && !graduate.is_published) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(graduate);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get graduate profile with linked CV
exports.getGraduateProfileWithCV = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.promise().query(
      `SELECT 
          g.id,
          g.full_name,
          g.major,
          g.graduation_year,
          g.skills,
          g.is_published,
          g.created_at,
          c.id AS cv_id,
          c.original_filename,
          c.stored_filename,
          c.file_path,
          c.uploaded_at
       FROM graduates g
       LEFT JOIN cv_files c ON g.id = c.graduate_id
       WHERE g.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Graduate not found" });
    }

    const profile = rows[0];

    // Restrict partner access to published profiles only.
    if (req.user.role === "partner" && !profile.is_published) {
      return res.status(403).json({ message: "Access denied" });
    }

    await logAction(req.user.id, "PROFILE_VIEW", "graduate", profile.id);

    res.json({
      id: profile.id,
      full_name: profile.full_name,
      major: profile.major,
      graduation_year: profile.graduation_year,
      skills: profile.skills,
      is_published: profile.is_published,
      created_at: profile.created_at,
      cv: profile.cv_id
        ? {
            cv_id: profile.cv_id,
            original_filename: profile.original_filename,
            uploaded_at: profile.uploaded_at,
            download_url: `/api/cv/download/${profile.cv_id}`
          }
        : null
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const fs = require("fs");
const path = require("path");

// Delete a graduate and all related CV files
exports.deleteGraduate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if graduate exists
    const [graduates] = await db.promise().query(
      "SELECT * FROM graduates WHERE id = ?",
      [id]
    );

    if (graduates.length === 0) {
      return res.status(404).json({ message: "Graduate not found" });
    }

    // Get CV files linked to this graduate
    const [cvFiles] = await db.promise().query(
      "SELECT * FROM cv_files WHERE graduate_id = ?",
      [id]
    );

    // Delete files from server
    for (const file of cvFiles) {
      const filePath = path.resolve(file.file_path);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove CV records from DB
    await db.promise().query(
      "DELETE FROM cv_files WHERE graduate_id = ?",
      [id]
    );

    // Remove graduate record
    await db.promise().query(
      "DELETE FROM graduates WHERE id = ?",
      [id]
    );

    // Log action
    await logAction(req.user.id, "GRADUATE_DELETE", "graduate", id);

    res.json({ message: "Graduate deleted successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
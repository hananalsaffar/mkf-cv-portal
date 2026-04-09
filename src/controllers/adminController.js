const db = require("../config/db");

// Get audit logs with readable user and target details
exports.getAuditLogs = async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT 
          a.id,
          a.action,
          a.target_type,
          a.target_id,
          a.created_at,
          u.full_name AS user_name,
          u.email AS user_email,
          u.role AS user_role,
          g.full_name AS graduate_name,
          c.original_filename AS cv_filename,
          p.full_name AS partner_name,
          p.organization_name AS partner_organization
       FROM audit_logs a
       LEFT JOIN users u 
         ON a.user_id = u.id
       LEFT JOIN graduates g 
         ON a.target_type = 'graduate' AND a.target_id = g.id
       LEFT JOIN cv_files c 
         ON a.target_type = 'cv_file' AND a.target_id = c.id
       LEFT JOIN users p
         ON a.target_type = 'user' AND a.target_id = p.id
       ORDER BY a.created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get report of most accessed CVs
exports.getMostAccessedCVs = async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT
          c.id AS cv_id,
          c.original_filename AS cv_filename,
          g.full_name AS graduate_name,
          COUNT(a.id) AS access_count
       FROM audit_logs a
       INNER JOIN cv_files c
         ON a.target_type = 'cv_file' AND a.target_id = c.id
       LEFT JOIN graduates g
         ON c.graduate_id = g.id
       WHERE a.action = 'CV_DOWNLOAD'
       GROUP BY c.id, c.original_filename, g.full_name
       ORDER BY access_count DESC, c.original_filename ASC`
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get access history by partner organization
exports.getAccessHistoryByOrganization = async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT
          u.id AS partner_id,
          u.full_name AS partner_name,
          u.organization_name,
          a.action,
          a.target_type,
          a.target_id,
          a.created_at,
          g.full_name AS graduate_name,
          c.original_filename AS cv_filename
       FROM audit_logs a
       INNER JOIN users u
         ON a.user_id = u.id
       LEFT JOIN graduates g
         ON a.target_type = 'graduate' AND a.target_id = g.id
       LEFT JOIN cv_files c
         ON a.target_type = 'cv_file' AND a.target_id = c.id
       WHERE u.role = 'partner'
         AND a.action IN ('PROFILE_VIEW', 'CV_DOWNLOAD')
       ORDER BY u.organization_name ASC, a.created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
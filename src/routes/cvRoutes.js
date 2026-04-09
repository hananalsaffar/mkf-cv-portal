const express = require("express");
const router = express.Router();

const { uploadCV, downloadCV, extractCVDetails } = require("../controllers/cvController");
const { upload, extractUpload } = require("../middleware/uploadMiddleware");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// Extract details from CV before saving the graduate
router.post(
  "/extract-details",
  authenticateToken,
  authorizeRoles("admin"),
  extractUpload.single("cv"),
  extractCVDetails
);

// Upload CV file after graduate is created
router.post(
  "/upload",
  authenticateToken,
  authorizeRoles("admin"),
  upload.single("cv"),
  uploadCV
);

// Allow admin and partner to download CV if permitted
router.get(
  "/download/:id",
  authenticateToken,
  authorizeRoles("admin", "partner"),
  downloadCV
);

module.exports = router;
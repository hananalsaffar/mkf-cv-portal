const express = require("express");
const router = express.Router();

const {
  createGraduate,
  updateGraduate,
  setGraduatePublishStatus,
  getPublishedGraduates,
  getGraduateById,
  getGraduateProfileWithCV,
  deleteGraduate
} = require("../controllers/graduateController");

const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// Only admin can create graduate records.
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  createGraduate
);

// Only admin can update graduate records.
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  updateGraduate
);

// Only admin can delete graduate records.
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  deleteGraduate
);

// Only admin can control publish status.
router.patch(
  "/:id/publish",
  authenticateToken,
  authorizeRoles("admin"),
  setGraduatePublishStatus
);

// Admin sees all, partner sees only published
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "partner"),
  getPublishedGraduates
);

// Get single graduate
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "partner"),
  getGraduateById
);

// Get graduate profile with CV
router.get(
  "/:id/profile",
  authenticateToken,
  authorizeRoles("admin", "partner"),
  getGraduateProfileWithCV
);

module.exports = router;
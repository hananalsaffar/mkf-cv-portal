const express = require("express");
const router = express.Router();

const {
  getAuditLogs,
  getMostAccessedCVs,
  getAccessHistoryByOrganization
} = require("../controllers/adminController");

const {
  createPartner,
  getPartners,
  updatePartnerStatus,
  resetPartnerPassword
} = require("../controllers/partnerController");

const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// Protect all admin routes
router.use(authenticateToken);
router.use(authorizeRoles("admin"));

// Audit logs
router.get("/audit-logs", getAuditLogs);

// Reports
router.get("/reports/most-accessed-cvs", getMostAccessedCVs);
router.get("/reports/access-history", getAccessHistoryByOrganization);

// Partner account management
router.post("/partners", createPartner);
router.get("/partners", getPartners);
router.patch("/partners/:id/status", updatePartnerStatus);
router.post("/partners/:id/reset-password", resetPartnerPassword);

module.exports = router;
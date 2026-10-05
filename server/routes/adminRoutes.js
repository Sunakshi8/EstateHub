const express = require("express");
const router = express.Router();
const {
  getPendingProperties,
  moderateProperty,
  getAllUsers,
  getReportedReviews,
  deleteReview,
  getStats,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin"));

router.get("/properties/pending", getPendingProperties);
router.put("/properties/:id/moderate", moderateProperty);
router.get("/users", getAllUsers);
router.get("/reviews/reported", getReportedReviews);
router.delete("/reviews/:id", deleteReview);
router.get("/stats", getStats);

module.exports = router;

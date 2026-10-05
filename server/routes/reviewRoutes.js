const express = require("express");
const router = express.Router();
const {
  createReview,
  getPropertyReviews,
  markHelpful,
  reportReview,
} = require("../controllers/reviewController");
const { protect } = require("../middleware/auth");

router.post("/", protect, createReview);
router.get("/property/:propertyId", getPropertyReviews);
router.put("/:id/helpful", protect, markHelpful);
router.put("/:id/report", protect, reportReview);

module.exports = router;

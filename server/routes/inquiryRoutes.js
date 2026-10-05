const express = require("express");
const router = express.Router();
const {
  createInquiry,
  getMyInquiries,
  getReceivedInquiries,
  respondToInquiry,
  closeInquiry,
} = require("../controllers/inquiryController");
const { protect } = require("../middleware/auth");

router.post("/", protect, createInquiry);
router.get("/sent", protect, getMyInquiries);
router.get("/received", protect, getReceivedInquiries);
router.put("/:id/respond", protect, respondToInquiry);
router.put("/:id/close", protect, closeInquiry);

module.exports = router;

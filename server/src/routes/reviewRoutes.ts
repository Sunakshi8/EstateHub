import { Router } from "express";
import {
  createReview,
  getPropertyReviews,
  markHelpful,
  reportReview,
} from "../controllers/reviewController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/", protect, createReview);
router.get("/property/:propertyId", getPropertyReviews);
router.put("/:id/helpful", protect, markHelpful);
router.put("/:id/report", protect, reportReview);

export default router;

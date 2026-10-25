import { Router } from "express";
import {
  deleteReview,
  getAllUsers,
  getPendingProperties,
  getReportedReviews,
  getStats,
  moderateProperty,
} from "../controllers/adminController";
import { authorize, protect } from "../middleware/auth";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/properties/pending", getPendingProperties);
router.put("/properties/:id/moderate", moderateProperty);
router.get("/users", getAllUsers);
router.get("/reviews/reported", getReportedReviews);
router.delete("/reviews/:id", deleteReview);
router.get("/stats", getStats);

export default router;

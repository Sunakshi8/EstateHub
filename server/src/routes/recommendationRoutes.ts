import { Router } from "express";
import { getMyPreferences, getRecommendations } from "../controllers/recommendationController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/", protect, getRecommendations);
router.get("/preferences", protect, getMyPreferences);

export default router;

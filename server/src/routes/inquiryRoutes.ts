import { Router } from "express";
import {
  closeInquiry,
  createInquiry,
  getMyInquiries,
  getReceivedInquiries,
  respondToInquiry,
} from "../controllers/inquiryController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/", protect, createInquiry);
router.get("/sent", protect, getMyInquiries);
router.get("/received", protect, getReceivedInquiries);
router.put("/:id/respond", protect, respondToInquiry);
router.put("/:id/close", protect, closeInquiry);

export default router;

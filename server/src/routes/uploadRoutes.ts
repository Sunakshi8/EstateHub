import { Router, type ErrorRequestHandler } from "express";
import { authorize, protect } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

// @route POST /api/upload  (agent, admin) - multipart/form-data, field "images", up to 8 files
router.post("/", protect, authorize("agent", "admin"), upload.array("images", 8), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) return res.status(400).json({ message: "No files uploaded" });
  return res.json({ urls: files.map((f) => `/uploads/${f.filename}`) });
});

// Errors thrown synchronously by multer's fileFilter surface here as 400s
const uploadErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (err) return res.status(400).json({ message: err.message });
  return next();
};
router.use(uploadErrors);

export default router;

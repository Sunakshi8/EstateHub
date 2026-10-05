const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protect, authorize } = require("../middleware/auth");

// @route POST /api/upload  (agent, admin) - multipart/form-data, field name "images", up to 8 files
router.post(
  "/",
  protect,
  authorize("agent", "admin"),
  upload.array("images", 8),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }
    const urls = req.files.map((f) => `/uploads/${f.filename}`);
    return res.json({ urls });
  }
);

// Multer errors surface here if thrown synchronously in fileFilter
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ message: err.message });
  next();
});

module.exports = router;

const express = require("express");
const router = express.Router();
const {
  createProperty,
  getProperties,
  getMyProperties,
  getFavorites,
  getPropertyById,
  updateProperty,
  deleteProperty,
  toggleFavorite,
} = require("../controllers/propertyController");
const { protect, authorize } = require("../middleware/auth");

// Optional-auth wrapper: attach req.user if a valid token is present, but don't block if not
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer")) {
    try {
      const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch (err) {
      // ignore invalid token for optional auth routes
    }
  }
  next();
};

// Specific routes BEFORE the /:id catch-all
router.get("/mine", protect, authorize("agent", "admin"), getMyProperties);
router.get("/favorites", protect, getFavorites);

router.get("/", getProperties);
router.post("/", protect, authorize("agent", "admin"), createProperty);

router.get("/:id", optionalAuth, getPropertyById);
router.put("/:id", protect, updateProperty);
router.delete("/:id", protect, deleteProperty);
router.put("/:id/favorite", protect, toggleFavorite);

module.exports = router;

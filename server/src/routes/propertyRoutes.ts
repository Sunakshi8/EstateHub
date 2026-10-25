import { Router } from "express";
import {
  createProperty,
  deleteProperty,
  getFavorites,
  getMyProperties,
  getProperties,
  getPropertyById,
  toggleFavorite,
  updateProperty,
} from "../controllers/propertyController";
import { authorize, optionalAuth, protect } from "../middleware/auth";

const router = Router();

// Specific routes BEFORE the /:id catch-all
router.get("/mine", protect, authorize("agent", "admin"), getMyProperties);
router.get("/favorites", protect, getFavorites);

router.get("/", optionalAuth, getProperties);
router.post("/", protect, authorize("agent", "admin"), createProperty);

router.get("/:id", optionalAuth, getPropertyById);
router.put("/:id", protect, updateProperty);
router.delete("/:id", protect, deleteProperty);
router.put("/:id/favorite", protect, toggleFavorite);

export default router;

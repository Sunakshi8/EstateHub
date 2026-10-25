import { User } from "../models/User";
import { asyncHandler } from "../middleware/asyncHandler";
import { generateToken } from "../utils/generateToken";

// @route POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    return res.status(400).json({ message: "An account with this email already exists" });
  }

  const allowedRoles = ["buyer", "agent"]; // admin accounts are not self-registrable
  const finalRole = allowedRoles.includes(role) ? role : "buyer";

  const user = await User.create({ name, email, password, role: finalRole, phone });
  return res.status(201).json({ user: user.toSafeObject(), token: generateToken(user._id) });
});

// @route POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  return res.json({ user: user.toSafeObject(), token: generateToken(user._id) });
});

// @route GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  return res.json({ user: req.user!.toSafeObject() });
});

// @route PUT /api/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const user = await User.findById(req.user!._id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (avatar !== undefined) user.avatar = avatar;

  await user.save();
  return res.json({ user: user.toSafeObject() });
});

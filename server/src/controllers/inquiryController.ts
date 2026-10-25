import { Inquiry } from "../models/Inquiry";
import { Property } from "../models/Property";
import { events } from "../events/emitters";
import { asyncHandler } from "../middleware/asyncHandler";
import { idString } from "../utils/ids";

const COOLDOWN_HOURS = 24;

// @route POST /api/inquiries  (buyer)
export const createInquiry = asyncHandler(async (req, res) => {
  const { propertyId, message, type, preferredDate } = req.body;
  if (!propertyId || !message) {
    return res.status(400).json({ message: "propertyId and message are required" });
  }

  const user = req.user!;
  const property = await Property.findById(propertyId);
  if (!property) return res.status(404).json({ message: "Property not found" });

  if (idString(property.owner) === idString(user._id)) {
    return res.status(400).json({ message: "You cannot inquire about your own listing" });
  }

  const base = {
    propertyId: String(propertyId),
    buyerId: idString(user._id),
    agentId: idString(property.owner),
  };

  const existing = await Inquiry.findOne({ property: propertyId, buyer: user._id });

  if (existing) {
    const hoursSince = (Date.now() - new Date(existing.lastInquiryAt).getTime()) / 36e5;
    if (hoursSince < COOLDOWN_HOURS) {
      return res.status(429).json({
        message: `You've already inquired about this property. Please wait ${Math.ceil(
          COOLDOWN_HOURS - hoursSince
        )} more hour(s) before sending another message.`,
      });
    }
    existing.messages.push({ sender: user._id, text: message, createdAt: new Date() });
    existing.lastInquiryAt = new Date();
    existing.status = "new";
    if (type) existing.type = type;
    if (preferredDate) existing.preferredDate = preferredDate;
    await existing.save();

    events.inquiry(
      "inquiry.reopened",
      { ...base, inquiryId: idString(existing._id), inquiryType: existing.type },
      req.correlationId
    );
    return res.status(200).json({ inquiry: existing });
  }

  const inquiry = await Inquiry.create({
    property: propertyId,
    buyer: user._id,
    agent: property.owner,
    type: type || "general",
    preferredDate: preferredDate || undefined,
    messages: [{ sender: user._id, text: message, createdAt: new Date() }],
    lastInquiryAt: new Date(),
  });

  events.inquiry(
    "inquiry.created",
    { ...base, inquiryId: idString(inquiry._id), inquiryType: inquiry.type },
    req.correlationId
  );
  return res.status(201).json({ inquiry });
});

// @route GET /api/inquiries/sent  (buyer)
export const getMyInquiries = asyncHandler(async (req, res) => {
  const inquiries = await Inquiry.find({ buyer: req.user!._id })
    .populate("property", "title images price location bookingStatus")
    .populate("agent", "name email phone")
    .sort({ updatedAt: -1 });
  return res.json({ inquiries });
});

// @route GET /api/inquiries/received  (agent)
export const getReceivedInquiries = asyncHandler(async (req, res) => {
  const inquiries = await Inquiry.find({ agent: req.user!._id })
    .populate("property", "title images price location")
    .populate("buyer", "name email phone")
    .sort({ updatedAt: -1 });
  return res.json({ inquiries });
});

// @route PUT /api/inquiries/:id/respond  (agent or buyer - reply in thread)
export const respondToInquiry = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: "Message text is required" });

  const user = req.user!;
  const inquiry = await Inquiry.findById(req.params.id);
  if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

  const isBuyer = idString(inquiry.buyer) === idString(user._id);
  const isAgent = idString(inquiry.agent) === idString(user._id);
  if (!isBuyer && !isAgent) {
    return res.status(403).json({ message: "Not authorized on this inquiry" });
  }

  inquiry.messages.push({ sender: user._id, text: message, createdAt: new Date() });
  inquiry.status = "responded";

  const hasBuyerMsg = inquiry.messages.some((m) => idString(m.sender) === idString(inquiry.buyer));
  const hasAgentMsg = inquiry.messages.some((m) => idString(m.sender) === idString(inquiry.agent));
  if (hasBuyerMsg && hasAgentMsg) inquiry.contactRevealed = true;

  await inquiry.save();
  return res.json({ inquiry });
});

// @route PUT /api/inquiries/:id/close
export const closeInquiry = asyncHandler(async (req, res) => {
  const user = req.user!;
  const inquiry = await Inquiry.findById(req.params.id);
  if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

  const isBuyer = idString(inquiry.buyer) === idString(user._id);
  const isAgent = idString(inquiry.agent) === idString(user._id);
  if (!isBuyer && !isAgent) {
    return res.status(403).json({ message: "Not authorized on this inquiry" });
  }

  inquiry.status = "closed";
  await inquiry.save();
  return res.json({ inquiry });
});

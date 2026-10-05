const Inquiry = require("../models/Inquiry");
const Property = require("../models/Property");
const { publishEvent } = require("../events/kafkaProducer");
const { INQUIRY_CREATED } = require("../events/topics");

const COOLDOWN_HOURS = 24;

// @route POST /api/inquiries  (buyer)
const createInquiry = async (req, res) => {
  try {
    const { propertyId, message, type, preferredDate } = req.body;
    if (!propertyId || !message) {
      return res.status(400).json({ message: "propertyId and message are required" });
    }

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    if (String(property.owner) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot inquire about your own listing" });
    }

    const existing = await Inquiry.findOne({ property: propertyId, buyer: req.user._id });

    if (existing) {
      const hoursSince = (Date.now() - new Date(existing.lastInquiryAt).getTime()) / 36e5;
      if (hoursSince < COOLDOWN_HOURS) {
        return res.status(429).json({
          message: `You've already inquired about this property. Please wait ${Math.ceil(
            COOLDOWN_HOURS - hoursSince
          )} more hour(s) before sending another message.`,
        });
      }
      existing.messages.push({ sender: req.user._id, text: message });
      existing.lastInquiryAt = new Date();
      existing.status = "new";
      if (type) existing.type = type;
      if (preferredDate) existing.preferredDate = preferredDate;
      await existing.save();

      // Fire-and-forget event for the notification-consumer service.
      // Never blocks or fails the request — see events/kafkaProducer.js.
      publishEvent(INQUIRY_CREATED, {
        event: "inquiry.reopened",
        inquiryId: String(existing._id),
        propertyId: String(propertyId),
        buyerId: String(req.user._id),
        agentId: String(property.owner),
      });

      return res.status(200).json({ inquiry: existing });
    }

    const inquiry = await Inquiry.create({
      property: propertyId,
      buyer: req.user._id,
      agent: property.owner,
      type: type || "general",
      preferredDate: preferredDate || undefined,
      messages: [{ sender: req.user._id, text: message }],
      lastInquiryAt: new Date(),
    });

    publishEvent(INQUIRY_CREATED, {
      event: "inquiry.created",
      inquiryId: String(inquiry._id),
      propertyId: String(propertyId),
      buyerId: String(req.user._id),
      agentId: String(property.owner),
      inquiryType: inquiry.type,
    });

    return res.status(201).json({ inquiry });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/inquiries/sent  (buyer)
const getMyInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ buyer: req.user._id })
      .populate("property", "title images price location bookingStatus")
      .populate("agent", "name email phone")
      .sort({ updatedAt: -1 });
    return res.json({ inquiries });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/inquiries/received  (agent)
const getReceivedInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ agent: req.user._id })
      .populate("property", "title images price location")
      .populate("buyer", "name email phone")
      .sort({ updatedAt: -1 });
    return res.json({ inquiries });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/inquiries/:id/respond  (agent or buyer - reply in thread)
const respondToInquiry = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message text is required" });

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

    const isBuyer = String(inquiry.buyer) === String(req.user._id);
    const isAgent = String(inquiry.agent) === String(req.user._id);
    if (!isBuyer && !isAgent) {
      return res.status(403).json({ message: "Not authorized on this inquiry" });
    }

    inquiry.messages.push({ sender: req.user._id, text: message });
    inquiry.status = "responded";

    const hasBuyerMsg = inquiry.messages.some((m) => String(m.sender) === String(inquiry.buyer));
    const hasAgentMsg = inquiry.messages.some((m) => String(m.sender) === String(inquiry.agent));
    if (hasBuyerMsg && hasAgentMsg) {
      inquiry.contactRevealed = true;
    }

    await inquiry.save();
    return res.json({ inquiry });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/inquiries/:id/close
const closeInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

    const isBuyer = String(inquiry.buyer) === String(req.user._id);
    const isAgent = String(inquiry.agent) === String(req.user._id);
    if (!isBuyer && !isAgent) {
      return res.status(403).json({ message: "Not authorized on this inquiry" });
    }

    inquiry.status = "closed";
    await inquiry.save();
    return res.json({ inquiry });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createInquiry,
  getMyInquiries,
  getReceivedInquiries,
  respondToInquiry,
  closeInquiry,
};

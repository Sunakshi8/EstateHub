// Must stay identical to server/events/topics.js — these two services are
// deployed independently, so this small constant is intentionally mirrored
// rather than imported across service boundaries.
module.exports = {
  INQUIRY_CREATED: "estatehub.inquiries",
};

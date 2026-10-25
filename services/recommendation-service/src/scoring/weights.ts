// All tunable knobs of the recommender live here.

/** How much one interaction teaches us about a user's taste. */
export const INTERACTION_WEIGHTS = {
  viewed: 1,
  favorited: 4,
  unfavorited: -3, // partially cancels the favorite
  inquiryCreated: 8, // strongest buying-intent signal
  siteVisitInquiry: 10,
  inquiryReopened: 3,
  search: 0.5, // a filter is intent, but weaker than touching a listing
} as const;

/** How much each kind of attribute matters when matching a property. */
export const FEATURE_WEIGHTS = {
  city: 3,
  locality: 1.5,
  property_type: 2.5,
  price_band: 3,
  bedrooms: 2,
  furnishing: 1,
  amenity: 1.5,
} as const;

export type FeatureType = keyof typeof FEATURE_WEIGHTS;

export const TOTAL_FEATURE_WEIGHT = Object.values(FEATURE_WEIGHTS).reduce((a, b) => a + b, 0);

/** Final = PREFERENCE_SHARE * preference match + (1 - PREFERENCE_SHARE) * popularity. */
export const PREFERENCE_SHARE = 0.85;

/** Neighbouring price bands earn partial credit (bands are ~35% apart). */
export const ADJACENT_PRICE_BAND_CREDIT = 0.5;

export const POPULARITY_WINDOW_DAYS = 30;

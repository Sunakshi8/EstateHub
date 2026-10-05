const typeDefs = `#graphql
  type Location {
    address: String
    city: String
    locality: String
    lat: Float
    lng: Float
  }

  type Owner {
    id: ID
    name: String
    email: String
    phone: String
    role: String
  }

  type PriceHistoryEntry {
    price: Float
    changedAt: String
  }

  type Property {
    id: ID
    title: String
    description: String
    price: Float
    propertyType: String
    bedrooms: Int
    bathrooms: Int
    area: Float
    furnishing: String
    amenities: [String]
    images: [String]
    location: Location
    bookingStatus: String
    moderationStatus: String
    viewCount: Int
    lastUpdatedAt: String
    priceHistory: [PriceHistoryEntry]
    owner: Owner
    avgRating: Float
    reviewCount: Int
  }

  type PropertyConnection {
    properties: [Property]
    total: Int
    page: Int
    pages: Int
  }

  type ReviewUser {
    id: ID
    name: String
    avatar: String
  }

  type SubRatings {
    cleanliness: Int
    maintenance: Int
    safety: Int
    waterSupply: Int
    noise: Int
    management: Int
  }

  type Review {
    id: ID
    rating: Int
    subRatings: SubRatings
    text: String
    verified: Boolean
    helpfulVotes: Int
    user: ReviewUser
    createdAt: String
  }

  input PropertyFilterInput {
    keyword: String
    city: String
    propertyType: String
    minPrice: Float
    maxPrice: Float
    bedrooms: Int
    furnishing: String
    sort: String
    page: Int
    limit: Int
  }

  type Query {
    """
    Search approved property listings with the same filters as the REST
    /api/properties endpoint. Read-only — mutations stay on the REST API.
    """
    properties(filter: PropertyFilterInput): PropertyConnection

    """Fetch a single approved property by its id."""
    property(id: ID!): Property

    """Reviews for a given property, newest first, plus the average rating."""
    reviewsByProperty(propertyId: ID!): [Review]
  }
`;

module.exports = typeDefs;

/**
 * Seeds the database with an admin account, an agent account, a buyer account,
 * and two sample approved properties so you can log in and see the app working
 * immediately after cloning.
 *
 * Run with: npm run seed   (from the /server folder)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Property = require("./models/Property");

const run = async () => {
  await connectDB();

  await Promise.all([User.deleteMany({}), Property.deleteMany({})]);

  const admin = await User.create({
    name: "Admin User",
    email: "admin@estatehub.com",
    password: "admin123",
    role: "admin",
    phone: "9999999999",
  });

  const agent = await User.create({
    name: "Rahul Agent",
    email: "agent@estatehub.com",
    password: "agent123",
    role: "agent",
    phone: "9876543210",
  });

  const buyer = await User.create({
    name: "Priya Buyer",
    email: "buyer@estatehub.com",
    password: "buyer123",
    role: "buyer",
    phone: "9123456780",
  });

  await Property.create([
    {
      title: "Spacious 3BHK Apartment in Shimla",
      description:
        "A well-ventilated 3BHK apartment with mountain views, close to the main market and schools. Ideal for families.",
      price: 8500000,
      propertyType: "apartment",
      bedrooms: 3,
      bathrooms: 2,
      area: 1450,
      furnishing: "semi-furnished",
      amenities: ["Parking", "Lift", "Power Backup", "Water Supply"],
      images: [],
      location: {
        address: "Chhota Shimla Main Road",
        city: "Shimla",
        locality: "Chhota Shimla",
        lat: 31.1048,
        lng: 77.1734,
      },
      contactPhone: agent.phone,
      contactEmail: agent.email,
      owner: agent._id,
      moderationStatus: "approved",
      bookingStatus: "available",
      priceHistory: [{ price: 8500000 }],
    },
    {
      title: "Independent House with Garden, Mohali",
      description:
        "4BHK independent house with a private garden and covered parking in a quiet residential sector.",
      price: 12500000,
      propertyType: "house",
      bedrooms: 4,
      bathrooms: 3,
      area: 2200,
      furnishing: "unfurnished",
      amenities: ["Garden", "Parking", "Security"],
      images: [],
      location: {
        address: "Sector 74, Phase 8B",
        city: "Mohali",
        locality: "Sector 74",
        lat: 30.7046,
        lng: 76.7179,
      },
      contactPhone: agent.phone,
      contactEmail: agent.email,
      owner: agent._id,
      moderationStatus: "approved",
      bookingStatus: "available",
      priceHistory: [{ price: 12500000 }],
    },
  ]);

  console.log("Seed complete. Demo accounts:");
  console.log("  Admin -> admin@estatehub.com / admin123");
  console.log("  Agent -> agent@estatehub.com / agent123");
  console.log("  Buyer -> buyer@estatehub.com / buyer123");

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

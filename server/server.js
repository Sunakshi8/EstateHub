require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { ApolloServer } = require("@apollo/server");
const { ApolloServerPluginDrainHttpServer } = require("@apollo/server/plugin/drainHttpServer");
const { expressMiddleware } = require("@as-integrations/express4");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const adminRoutes = require("./routes/adminRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

const typeDefs = require("./graphql/typeDefs");
const resolvers = require("./graphql/resolvers");

async function startServer() {
  await connectDB();

  const app = express();
  const httpServer = http.createServer(app);

  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded images statically
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  app.get("/api/health", (req, res) =>
    res.json({ status: "ok", time: new Date().toISOString() })
  );

  // --- GraphQL (read-only search API, mounted alongside the REST routes below) ---
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });
  await apolloServer.start();
  app.use(
    "/graphql",
    cors(),
    express.json(),
    expressMiddleware(apolloServer)
  );

  // --- REST API ---
  app.use("/api/auth", authRoutes);
  app.use("/api/properties", propertyRoutes);
  app.use("/api/inquiries", inquiryRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/upload", uploadRoutes);

  // 404 handler for unknown API routes
  app.use("/api", (req, res) => res.status(404).json({ message: "API route not found" }));

  // Global error handler (catches anything thrown in async controllers via next(err))
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  });

  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`EstateHub API running on port ${PORT}`);
    console.log(`GraphQL endpoint:  http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

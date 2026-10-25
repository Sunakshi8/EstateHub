import React, { useEffect, useState } from "react";
import api from "../api/axios";
import PropertyCard from "./PropertyCard";

/**
 * "Recommended for you" — backed by GET /api/recommendations, i.e. the
 * Kafka -> recommendation-service -> PostgreSQL preference-score pipeline.
 * Each card shows the match score and why it was recommended.
 */
export default function RecommendedProperties() {
  const [items, setItems] = useState([]);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/recommendations", { params: { limit: 6 } })
      .then((res) => {
        setItems(res.data.recommendations || []);
        setSource(res.data.source);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Finding homes you'll like…</p>;
  if (!items.length) {
    return <p className="text-gray-500">Browse and favorite a few listings — we'll learn what you like.</p>;
  }

  const subtitle =
    source === "personalized"
      ? "Ranked by your preference score"
      : source === "popular"
      ? "Popular right now — interact with listings to personalize this"
      : "Latest listings (personalization is warming up)";

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{subtitle}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((p) => (
          <div key={p._id}>
            <PropertyCard property={p} />
            {p.recommendation?.score != null && (
              <div className="mt-2 text-xs text-gray-600">
                <span className="inline-block bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                  {Math.round(p.recommendation.score)}% match
                </span>
                {p.recommendation.reasons?.map((r) => (
                  <div key={r} className="mt-1">• {r}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

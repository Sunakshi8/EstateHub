import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import PropertyCard from "../components/PropertyCard";

function formatPrice(price) {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

export default function BuyerDashboard() {
  const [tab, setTab] = useState("favorites");
  const [favorites, setFavorites] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [replyText, setReplyText] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [favRes, inqRes] = await Promise.all([
        api.get("/properties/favorites"),
        api.get("/inquiries/sent"),
      ]);
      setFavorites(favRes.data.properties);
      setInquiries(inqRes.data.inquiries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async (inquiryId) => {
    const text = replyText[inquiryId];
    if (!text) return;
    try {
      await api.put(`/inquiries/${inquiryId}/respond`, { message: text });
      setReplyText({ ...replyText, [inquiryId]: "" });
      loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Dashboard</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab("favorites")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "favorites" ? "border-b-2 border-brand-500 text-brand-500" : "text-gray-500"
          }`}
        >
          Saved Properties ({favorites.length})
        </button>
        <button
          onClick={() => setTab("inquiries")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "inquiries" ? "border-b-2 border-brand-500 text-brand-500" : "text-gray-500"
          }`}
        >
          My Inquiries ({inquiries.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : tab === "favorites" ? (
        favorites.length === 0 ? (
          <p className="text-gray-400">
            No saved properties yet.{" "}
            <Link to="/" className="text-brand-500">
              Browse listings
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {favorites.map((p) => (
              <PropertyCard key={p._id} property={p} />
            ))}
          </div>
        )
      ) : inquiries.length === 0 ? (
        <p className="text-gray-400">You haven't sent any inquiries yet.</p>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inq) => (
            <div key={inq._id} className="card p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <Link to={`/properties/${inq.property?._id}`} className="font-medium hover:text-brand-500">
                  {inq.property?.title}
                </Link>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-brand-500">
                    {formatPrice(inq.property?.price || 0)}
                  </p>
                  <span className="text-xs capitalize bg-gray-100 px-2 py-0.5 rounded-full">
                    {inq.status}
                  </span>
                </div>
              </div>

              {inq.contactRevealed && (
                <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-lg mb-3">
                  Contact revealed: {inq.agent?.name} · {inq.agent?.phone} · {inq.agent?.email}
                </div>
              )}

              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {inq.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm px-3 py-2 rounded-lg max-w-md ${
                      String(m.sender) === String(inq.buyer)
                        ? "bg-brand-50 ml-auto text-right"
                        : "bg-gray-100"
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>

              {inq.status !== "closed" && (
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1"
                    placeholder="Reply..."
                    value={replyText[inq._id] || ""}
                    onChange={(e) => setReplyText({ ...replyText, [inq._id]: e.target.value })}
                  />
                  <button onClick={() => sendReply(inq._id)} className="btn-primary shrink-0">
                    Send
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

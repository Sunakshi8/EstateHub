import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

function formatPrice(price) {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AgentDashboard() {
  const [tab, setTab] = useState("listings");
  const [listings, setListings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [replyText, setReplyText] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [listRes, inqRes] = await Promise.all([
        api.get("/properties/mine"),
        api.get("/inquiries/received"),
      ]);
      setListings(listRes.data.properties);
      setInquiries(inqRes.data.inquiries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (propertyId) => {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    try {
      await api.delete(`/properties/${propertyId}`);
      loadAll();
    } catch (err) {
      console.error(err);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
        <button onClick={() => navigate("/properties/new")} className="btn-primary">
          + Add Listing
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab("listings")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "listings" ? "border-b-2 border-brand-500 text-brand-500" : "text-gray-500"
          }`}
        >
          My Listings ({listings.length})
        </button>
        <button
          onClick={() => setTab("leads")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "leads" ? "border-b-2 border-brand-500 text-brand-500" : "text-gray-500"
          }`}
        >
          Leads / Inquiries ({inquiries.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : tab === "listings" ? (
        listings.length === 0 ? (
          <p className="text-gray-400">You haven't listed any properties yet.</p>
        ) : (
          <div className="space-y-3">
            {listings.map((p) => (
              <div key={p._id} className="card p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Link to={`/properties/${p._id}`} className="font-medium hover:text-brand-500">
                    {p.title}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {formatPrice(p.price)} · {p.location.city} · {p.viewCount} views
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColors[p.moderationStatus]}`}>
                  {p.moderationStatus}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => navigate(`/properties/${p._id}/edit`)} className="btn-secondary text-sm">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p._id)}
                    className="text-sm text-red-500 hover:text-red-700 px-3"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : inquiries.length === 0 ? (
        <p className="text-gray-400">No inquiries received yet.</p>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inq) => (
            <div key={inq._id} className="card p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <Link to={`/properties/${inq.property?._id}`} className="font-medium hover:text-brand-500">
                    {inq.property?.title}
                  </Link>
                  <p className="text-xs text-gray-400">From: {inq.buyer?.name}</p>
                </div>
                <span className="text-xs capitalize bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                  {inq.status}
                </span>
              </div>

              {inq.contactRevealed && (
                <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-lg mb-3">
                  Contact revealed: {inq.buyer?.name} · {inq.buyer?.phone} · {inq.buyer?.email}
                </div>
              )}

              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {inq.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm px-3 py-2 rounded-lg max-w-md ${
                      String(m.sender) === String(inq.agent)
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

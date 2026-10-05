import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

function formatPrice(price) {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("pending");
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [reportedReviews, setReportedReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, usersRes, reviewsRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/properties/pending"),
        api.get("/admin/users"),
        api.get("/admin/reviews/reported"),
      ]);
      setStats(statsRes.data);
      setPending(pendingRes.data.properties);
      setUsers(usersRes.data.users);
      setReportedReviews(reviewsRes.data.reviews);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const moderate = async (id, status) => {
    try {
      await api.put(`/admin/properties/${id}/moderate`, { status });
      loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  const removeReview = async (id) => {
    if (!confirm("Remove this reported review?")) return;
    try {
      await api.delete(`/admin/reviews/${id}`);
      loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          {[
            ["Listings", stats.totalListings],
            ["Pending Review", stats.pendingListings],
            ["Users", stats.totalUsers],
            ["Inquiries", stats.totalInquiries],
            ["Reviews", stats.totalReviews],
          ].map(([label, value]) => (
            <div key={label} className="card p-4 text-center">
              <p className="text-2xl font-bold text-brand-500">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-gray-200 flex-wrap">
        {[
          ["pending", `Pending Listings (${pending.length})`],
          ["users", `Users (${users.length})`],
          ["reviews", `Reported Reviews (${reportedReviews.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === key ? "border-b-2 border-brand-500 text-brand-500" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : tab === "pending" ? (
        pending.length === 0 ? (
          <p className="text-gray-400">No listings awaiting review.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p._id} className="card p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Link to={`/properties/${p._id}`} className="font-medium hover:text-brand-500">
                    {p.title}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {formatPrice(p.price)} · {p.location.city} · by {p.owner?.name}
                  </p>
                  {p.duplicateOf && (
                    <p className="text-xs text-yellow-600 mt-1">
                      ⚠ Possible duplicate of "{p.duplicateOf.title}"
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => moderate(p._id, "approved")} className="btn-primary text-sm">
                    Approve
                  </button>
                  <button
                    onClick={() => moderate(p._id, "rejected")}
                    className="text-sm text-red-500 hover:text-red-700 px-3"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "users" ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{u.role}</td>
                  <td className="px-4 py-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : reportedReviews.length === 0 ? (
        <p className="text-gray-400">No reported reviews.</p>
      ) : (
        <div className="space-y-3">
          {reportedReviews.map((r) => (
            <div key={r._id} className="card p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{r.user?.name}</p>
                <p className="text-xs text-gray-400 mb-1">on "{r.property?.title}"</p>
                <p className="text-sm text-gray-600">{r.text}</p>
              </div>
              <button onClick={() => removeReview(r._id)} className="text-sm text-red-500 hover:text-red-700 shrink-0">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

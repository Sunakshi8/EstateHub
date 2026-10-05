import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../api/axios";
import MapView from "../components/MapView";
import StarRating from "../components/StarRating";

function formatPrice(price) {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

const SUB_RATING_KEYS = [
  ["cleanliness", "Cleanliness"],
  ["maintenance", "Maintenance"],
  ["safety", "Safety"],
  ["waterSupply", "Water Supply"],
  ["noise", "Noise Levels"],
  ["management", "Management"],
];

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useSelector((state) => state.auth);

  const [property, setProperty] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);

  const [inquiryMsg, setInquiryMsg] = useState("");
  const [inquiryType, setInquiryType] = useState("general");
  const [preferredDate, setPreferredDate] = useState("");
  const [inquiryStatus, setInquiryStatus] = useState(null);

  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    text: "",
    subRatings: { cleanliness: 5, maintenance: 5, safety: 5, waterSupply: 5, noise: 5, management: 5 },
  });
  const [reviewStatus, setReviewStatus] = useState(null);

  const isFavorited = user?.favorites?.some((f) => f === property?._id || f?._id === property?._id);

  useEffect(() => {
    loadProperty();
    loadReviews();
  }, [id]);

  const loadProperty = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/properties/${id}`);
      setProperty(data.property);
    } catch (err) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const { data } = await api.get(`/reviews/property/${id}`);
      setReviews(data.reviews);
      setAvgRating(data.avgRating);
    } catch (err) {
      // ignore
    }
  };

  const handleFavorite = async () => {
    if (!token) return navigate("/login", { state: { from: `/properties/${id}` } });
    try {
      await api.put(`/properties/${id}/favorite`);
      loadProperty();
    } catch (err) {
      console.error(err);
    }
  };

  const handleInquiry = async (e) => {
    e.preventDefault();
    if (!token) return navigate("/login", { state: { from: `/properties/${id}` } });
    setInquiryStatus(null);
    try {
      await api.post("/inquiries", {
        propertyId: id,
        message: inquiryMsg,
        type: inquiryType,
        preferredDate: preferredDate || undefined,
      });
      setInquiryStatus({ type: "success", text: "Your message has been sent to the owner/agent." });
      setInquiryMsg("");
    } catch (err) {
      setInquiryStatus({ type: "error", text: err.response?.data?.message || "Failed to send inquiry" });
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!token) return navigate("/login", { state: { from: `/properties/${id}` } });
    setReviewStatus(null);
    try {
      await api.post("/reviews", { propertyId: id, ...reviewForm });
      setReviewStatus({ type: "success", text: "Thanks for your review!" });
      setReviewForm({
        rating: 5,
        text: "",
        subRatings: { cleanliness: 5, maintenance: 5, safety: 5, waterSupply: 5, noise: 5, management: 5 },
      });
      loadReviews();
    } catch (err) {
      setReviewStatus({ type: "error", text: err.response?.data?.message || "Failed to submit review" });
    }
  };

  const markHelpful = async (reviewId) => {
    if (!token) return navigate("/login", { state: { from: `/properties/${id}` } });
    try {
      await api.put(`/reviews/${reviewId}/helpful`);
      loadReviews();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center text-gray-400 py-20">Loading...</div>;
  if (notFound || !property)
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">This listing isn't available.</p>
        <Link to="/" className="text-brand-500 font-medium">
          Back to search
        </Link>
      </div>
    );

  const isOwner = user && String(property.owner?._id) === String(user._id);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {property.location?.address}, {property.location?.locality
              ? `${property.location.locality}, `
              : ""}
            {property.location?.city}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-brand-500">{formatPrice(property.price)}</p>
          <span className="text-xs capitalize bg-gray-100 px-2 py-1 rounded-full">
            {property.bookingStatus}
          </span>
        </div>
      </div>

      {/* Image gallery */}
      <div className="mb-6">
        <div className="h-80 bg-gray-100 rounded-xl overflow-hidden mb-2">
          {property.images?.length ? (
            <img
              src={property.images[activeImg]}
              alt={property.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No images uploaded for this listing
            </div>
          )}
        </div>
        {property.images?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {property.images.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setActiveImg(i)}
                className={`h-16 w-24 object-cover rounded-lg cursor-pointer border-2 ${
                  i === activeImg ? "border-brand-500" : "border-transparent"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Details */}
          <div className="card p-5">
            <div className="flex flex-wrap gap-6 text-sm mb-4">
              <div>
                <p className="text-gray-400">Bedrooms</p>
                <p className="font-semibold">{property.bedrooms}</p>
              </div>
              <div>
                <p className="text-gray-400">Bathrooms</p>
                <p className="font-semibold">{property.bathrooms}</p>
              </div>
              <div>
                <p className="text-gray-400">Area</p>
                <p className="font-semibold">{property.area} sq.ft</p>
              </div>
              <div>
                <p className="text-gray-400">Furnishing</p>
                <p className="font-semibold capitalize">{property.furnishing}</p>
              </div>
              <div>
                <p className="text-gray-400">Type</p>
                <p className="font-semibold capitalize">{property.propertyType}</p>
              </div>
            </div>
            <p className="text-gray-700 whitespace-pre-line">{property.description}</p>

            {property.amenities?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a) => (
                    <span key={a} className="bg-brand-50 text-brand-600 text-xs px-3 py-1 rounded-full">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
              <span>Last updated {new Date(property.lastUpdatedAt).toLocaleDateString()}</span>
              <span>{property.viewCount} views</span>
            </div>
          </div>

          {/* Map */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Location</h2>
            <MapView lat={property.location?.lat} lng={property.location?.lng} title={property.title} />
          </div>

          {/* Reviews */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                Reviews {reviews.length > 0 && `(${reviews.length})`}
              </h2>
              {avgRating > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating value={avgRating} readOnly />
                  <span className="text-sm text-gray-500">{avgRating} / 5</span>
                </div>
              )}
            </div>

            {reviews.length === 0 && (
              <p className="text-sm text-gray-400 mb-4">No reviews yet. Be the first to share your experience.</p>
            )}

            <div className="space-y-4 mb-6">
              {reviews.map((r) => (
                <div key={r._id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.user?.name || "Anonymous"}</span>
                      {r.verified && (
                        <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          Verified visit
                        </span>
                      )}
                    </div>
                    <StarRating value={r.rating} readOnly size="text-sm" />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{r.text}</p>
                  <button
                    onClick={() => markHelpful(r._id)}
                    className="text-xs text-gray-400 hover:text-brand-500 mt-2"
                  >
                    Helpful ({r.helpfulVotes})
                  </button>
                </div>
              ))}
            </div>

            {token && (
              <form onSubmit={handleReviewSubmit} className="border-t border-gray-100 pt-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Write a review</h3>
                <StarRating
                  value={reviewForm.rating}
                  onChange={(v) => setReviewForm({ ...reviewForm, rating: v })}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SUB_RATING_KEYS.map(([key, label]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500">{label}</label>
                      <StarRating
                        value={reviewForm.subRatings[key]}
                        size="text-sm"
                        onChange={(v) =>
                          setReviewForm({
                            ...reviewForm,
                            subRatings: { ...reviewForm.subRatings, [key]: v },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  required
                  className="input-field"
                  rows={3}
                  placeholder="Share your experience with this property..."
                  value={reviewForm.text}
                  onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })}
                />
                {reviewStatus && (
                  <p className={reviewStatus.type === "error" ? "text-red-600 text-sm" : "text-green-600 text-sm"}>
                    {reviewStatus.text}
                  </p>
                )}
                <button type="submit" className="btn-primary">
                  Submit Review
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Sidebar: contact / inquiry / favorite */}
        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-sm text-gray-500 mb-1">Listed by</p>
            <p className="font-semibold">{property.owner?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{property.owner?.role}</p>

            <button
              onClick={handleFavorite}
              className={`w-full mt-4 ${isFavorited ? "btn-primary" : "btn-secondary"}`}
            >
              {isFavorited ? "★ Saved to Favorites" : "☆ Save to Favorites"}
            </button>

            {isOwner && (
              <button
                onClick={() => navigate(`/properties/${id}/edit`)}
                className="btn-secondary w-full mt-2"
              >
                Edit Listing
              </button>
            )}
          </div>

          {!isOwner && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Contact Owner / Agent</h3>
              <p className="text-xs text-gray-400 mb-3">
                Your message goes to their inbox. Contact details are revealed once they reply.
              </p>
              <form onSubmit={handleInquiry} className="space-y-3">
                <select
                  className="input-field"
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value)}
                >
                  <option value="general">General Inquiry</option>
                  <option value="site-visit">Request Site Visit</option>
                </select>
                {inquiryType === "site-visit" && (
                  <input
                    type="date"
                    className="input-field"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                )}
                <textarea
                  required
                  rows={3}
                  className="input-field"
                  placeholder="I'm interested in this property..."
                  value={inquiryMsg}
                  onChange={(e) => setInquiryMsg(e.target.value)}
                />
                {inquiryStatus && (
                  <p className={inquiryStatus.type === "error" ? "text-red-600 text-sm" : "text-green-600 text-sm"}>
                    {inquiryStatus.text}
                  </p>
                )}
                <button type="submit" className="btn-primary w-full">
                  Send Inquiry
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

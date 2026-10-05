import React from "react";
import { Link } from "react-router-dom";

function formatPrice(price) {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

function daysAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated 1 day ago";
  return `Updated ${days} days ago`;
}

export default function PropertyCard({ property }) {
  const img = property.images?.[0];

  return (
    <Link
      to={`/properties/${property._id}`}
      className="card overflow-hidden hover:shadow-md transition-shadow block"
    >
      <div className="h-44 bg-gray-100 relative">
        {img ? (
          <img src={img} alt={property.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}
        <span className="absolute top-2 left-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-full capitalize">
          {property.bookingStatus}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
            {property.title}
          </h3>
        </div>
        <p className="text-brand-500 font-bold mt-1">{formatPrice(property.price)}</p>
        <p className="text-sm text-gray-500 mt-1">
          {property.location?.locality ? `${property.location.locality}, ` : ""}
          {property.location?.city}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
          {property.bedrooms > 0 && <span>{property.bedrooms} Bed</span>}
          {property.bathrooms > 0 && <span>{property.bathrooms} Bath</span>}
          {property.area > 0 && <span>{property.area} sq.ft</span>}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
          <span>{daysAgo(property.lastUpdatedAt || property.createdAt)}</span>
          <span>{property.viewCount || 0} views</span>
        </div>
      </div>
    </Link>
  );
}

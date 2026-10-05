import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

const emptyForm = {
  title: "",
  description: "",
  price: "",
  propertyType: "apartment",
  bedrooms: "",
  bathrooms: "",
  area: "",
  furnishing: "unfurnished",
  amenities: "",
  contactPhone: "",
  contactEmail: "",
  bookingStatus: "available",
  address: "",
  city: "",
  locality: "",
  lat: "",
  lng: "",
};

export default function AddEditProperty() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([]); // existing uploaded URLs
  const [newFiles, setNewFiles] = useState([]); // File objects pending upload
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  useEffect(() => {
    if (isEdit) loadProperty();
  }, [id]);

  const loadProperty = async () => {
    try {
      const { data } = await api.get(`/properties/${id}`);
      const p = data.property;
      setForm({
        title: p.title,
        description: p.description,
        price: p.price,
        propertyType: p.propertyType,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.area,
        furnishing: p.furnishing,
        amenities: (p.amenities || []).join(", "),
        contactPhone: p.contactPhone,
        contactEmail: p.contactEmail,
        bookingStatus: p.bookingStatus,
        address: p.location.address,
        city: p.location.city,
        locality: p.location.locality,
        lat: p.location.lat || "",
        lng: p.location.lng || "",
      });
      setImages(p.images || []);
    } catch (err) {
      setError("Could not load this listing for editing.");
    }
  };

  const handleGeocode = async () => {
    if (!form.address || !form.city) {
      setError("Enter an address and city before locating on the map.");
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const query = encodeURIComponent(`${form.address}, ${form.city}`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`
      );
      const results = await res.json();
      if (results.length === 0) {
        setError("Couldn't find that address on the map. You can still save without map coordinates.");
      } else {
        setForm((f) => ({ ...f, lat: results[0].lat, lng: results[0].lon }));
      }
    } catch (err) {
      setError("Geocoding service unavailable right now.");
    } finally {
      setGeocoding(false);
    }
  };

  const uploadNewImages = async () => {
    if (newFiles.length === 0) return [];
    const formData = new FormData();
    newFiles.forEach((file) => formData.append("images", file));
    const { data } = await api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.urls;
  };

  const removeExistingImage = (url) => {
    setImages(images.filter((i) => i !== url));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setDuplicateWarning(null);

    try {
      const uploadedUrls = await uploadNewImages();
      const allImages = [...images, ...uploadedUrls];

      const payload = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        propertyType: form.propertyType,
        bedrooms: Number(form.bedrooms) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        area: Number(form.area) || 0,
        furnishing: form.furnishing,
        amenities: form.amenities,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        bookingStatus: form.bookingStatus,
        images: allImages,
        location: {
          address: form.address,
          city: form.city,
          locality: form.locality,
          lat: form.lat ? Number(form.lat) : undefined,
          lng: form.lng ? Number(form.lng) : undefined,
        },
      };

      if (isEdit) {
        await api.put(`/properties/${id}`, payload);
        navigate(`/properties/${id}`);
      } else {
        const { data } = await api.post("/properties", payload);
        if (data.duplicateWarning) setDuplicateWarning(data.duplicateWarning);
        navigate(`/properties/${data.property._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save listing");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? "Edit Listing" : "Add New Listing"}
      </h1>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>
      )}
      {duplicateWarning && (
        <div className="bg-yellow-50 text-yellow-800 text-sm px-3 py-2 rounded-lg mb-4">
          {duplicateWarning}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            required
            className="input-field"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            required
            rows={4}
            className="input-field"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
            <input
              type="number"
              required
              className="input-field"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
            <select
              className="input-field"
              value={form.propertyType}
              onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
            >
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="plot">Plot</option>
              <option value="commercial">Commercial</option>
              <option value="rent">For Rent</option>
              <option value="buy">For Sale</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
            <input
              type="number"
              className="input-field"
              value={form.bedrooms}
              onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
            <input
              type="number"
              className="input-field"
              value={form.bathrooms}
              onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area (sq.ft)</label>
            <input
              type="number"
              className="input-field"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Furnishing</label>
            <select
              className="input-field"
              value={form.furnishing}
              onChange={(e) => setForm({ ...form, furnishing: e.target.value })}
            >
              <option value="furnished">Furnished</option>
              <option value="semi-furnished">Semi-furnished</option>
              <option value="unfurnished">Unfurnished</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booking Status</label>
            <select
              className="input-field"
              value={form.bookingStatus}
              onChange={(e) => setForm({ ...form, bookingStatus: e.target.value })}
            >
              <option value="available">Available</option>
              <option value="booked">Booked</option>
              <option value="sold">Sold</option>
              <option value="rented">Rented</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amenities (comma-separated)
          </label>
          <input
            className="input-field"
            placeholder="Parking, Lift, Power Backup"
            value={form.amenities}
            onChange={(e) => setForm({ ...form, amenities: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <input
              className="input-field"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input
              type="email"
              className="input-field"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Location</p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <input
              required
              placeholder="Address"
              className="input-field"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <input
              required
              placeholder="City"
              className="input-field"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <input
            placeholder="Locality / Neighborhood"
            className="input-field mb-3"
            value={form.locality}
            onChange={(e) => setForm({ ...form, locality: e.target.value })}
          />
          <button type="button" onClick={handleGeocode} disabled={geocoding} className="btn-secondary text-sm">
            {geocoding ? "Locating..." : "📍 Locate on Map"}
          </button>
          {form.lat && form.lng && (
            <span className="text-xs text-green-600 ml-3">
              Located: {Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}
            </span>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Images</p>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {images.map((url) => (
                <div key={url} className="relative">
                  <img src={url} className="h-20 w-20 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(url)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setNewFiles(Array.from(e.target.files))}
          />
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, or WebP. Up to 8 images.</p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? "Saving..." : isEdit ? "Update Listing" : "Publish Listing"}
        </button>
        {!isEdit && (
          <p className="text-xs text-gray-400 text-center">
            New listings are reviewed by an admin before appearing in search results.
          </p>
        )}
      </form>
    </div>
  );
}

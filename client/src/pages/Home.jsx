import React, { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import PropertyCard from "../components/PropertyCard";

const initialFilters = {
  keyword: "",
  city: "",
  propertyType: "",
  minPrice: "",
  maxPrice: "",
  bedrooms: "",
  furnishing: "",
  sort: "latest",
};

export default function Home() {
  const [filters, setFilters] = useState(initialFilters);
  const [properties, setProperties] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, page };
      Object.keys(params).forEach((k) => {
        if (params[k] === "") delete params[k];
      });
      const { data } = await api.get("/properties", { params });
      setProperties(data.properties);
      setPages(data.pages);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Find your next home</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total} propert{total === 1 ? "y" : "ies"} available
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters sidebar */}
        <aside className="card p-4 h-fit lg:sticky lg:top-20 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              className="input-field"
              placeholder="Title, city, locality..."
              value={filters.keyword}
              onChange={(e) => handleFilterChange("keyword", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
            <input
              className="input-field"
              placeholder="e.g. Shimla"
              value={filters.city}
              onChange={(e) => handleFilterChange("city", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Property Type</label>
            <select
              className="input-field"
              value={filters.propertyType}
              onChange={(e) => handleFilterChange("propertyType", e.target.value)}
            >
              <option value="">Any</option>
              <option value="rent">For Rent</option>
              <option value="buy">For Sale</option>
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="plot">Plot</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Price</label>
              <input
                type="number"
                className="input-field"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange("minPrice", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Price</label>
              <input
                type="number"
                className="input-field"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Bedrooms</label>
            <select
              className="input-field"
              value={filters.bedrooms}
              onChange={(e) => handleFilterChange("bedrooms", e.target.value)}
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Furnishing</label>
            <select
              className="input-field"
              value={filters.furnishing}
              onChange={(e) => handleFilterChange("furnishing", e.target.value)}
            >
              <option value="">Any</option>
              <option value="furnished">Furnished</option>
              <option value="semi-furnished">Semi-furnished</option>
              <option value="unfurnished">Unfurnished</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
            <select
              className="input-field"
              value={filters.sort}
              onChange={(e) => handleFilterChange("sort", e.target.value)}
            >
              <option value="latest">Latest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
          <button onClick={resetFilters} className="btn-secondary w-full text-sm">
            Reset Filters
          </button>
        </aside>

        {/* Results */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="text-center text-gray-400 py-16">Loading properties...</div>
          ) : properties.length === 0 ? (
            <div className="text-center text-gray-400 py-16">
              No properties match your filters. Try broadening your search.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {properties.map((p) => (
                  <PropertyCard key={p._id} property={p} />
                ))}
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    className="btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500 px-2">
                    Page {page} of {pages}
                  </span>
                  <button
                    className="btn-secondary"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

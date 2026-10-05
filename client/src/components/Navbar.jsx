import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/authSlice";

export default function Navbar() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  const dashboardPath =
    user?.role === "admin" ? "/admin" : user?.role === "agent" ? "/agent" : "/dashboard";

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-brand-500">
          Estate<span className="text-gray-900">Hub</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-gray-700 hover:text-brand-500">
            Browse
          </Link>

          {user && (user.role === "agent" || user.role === "admin") && (
            <Link to="/properties/new" className="text-gray-700 hover:text-brand-500">
              Add Listing
            </Link>
          )}

          {user ? (
            <>
              <Link to={dashboardPath} className="text-gray-700 hover:text-brand-500">
                Dashboard
              </Link>
              <span className="text-gray-400 hidden sm:inline">|</span>
              <span className="text-gray-500 hidden sm:inline">Hi, {user.name.split(" ")[0]}</span>
              <button onClick={handleLogout} className="btn-secondary py-1.5">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-700 hover:text-brand-500">
                Login
              </Link>
              <Link to="/register" className="btn-primary py-1.5">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

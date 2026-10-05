import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { loginUser, clearAuthError } from "../store/authSlice";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, error, token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      const redirect = location.state?.from || "/";
      navigate(redirect, { replace: true });
    }
  }, [token]);

  useEffect(() => {
    return () => dispatch(clearAuthError());
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser(form));
  };

  return (
    <div className="max-w-md mx-auto mt-12 px-4">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm mb-6">Log in to your EstateHub account</p>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="input-field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="input-field"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
            {status === "loading" ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          Don't have an account?{" "}
          <Link to="/register" className="text-brand-500 font-medium">
            Sign up
          </Link>
        </p>

        <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
          <p className="font-medium text-gray-500">Demo accounts (after running the seed script):</p>
          <p>Admin: admin@estatehub.com / admin123</p>
          <p>Agent: agent@estatehub.com / agent123</p>
          <p>Buyer: buyer@estatehub.com / buyer123</p>
        </div>
      </div>
    </div>
  );
}

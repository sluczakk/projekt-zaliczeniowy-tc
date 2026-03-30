import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

import "./Login.css";

import API_BASE_URL from "../config";

function Register({ setUser }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    repeatedpassword: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // jezeli uzytkownik jest juz zalogowany, przekierowujemy do dashboarda
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      navigate("/dashboard");
    }
  }, []);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Registration failed");
        return;
      }

      localStorage.setItem("token", data.token);
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/");
    } catch (err) {
      setError("Server error");
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2 className="login-title">Zarejestruj konto</h2>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <input
            className="login-input"
            type="password"
            name="password"
            placeholder="Hasło"
            value={form.password}
            onChange={handleChange}
            required
          />

         <input
            className="login-input"
            type="password"
            name="repeatedpassword"
            placeholder="Potwórz hasło"
            value={form.reppeatedpassword}
            onChange={handleChange}
            required
          />

          <button className="login-button" type="submit">
            Zarejestruj konto
          </button>
        </form>

        {error && <p className="login-error">{error}</p>}

        <div className="login-footer">
          Masz już konto?{" "}
          <span className="login-link" onClick={() => navigate("/")}>
             Zaloguj się
          </span>
        </div>
      </div>
    </div>
  );
}

export default Register;
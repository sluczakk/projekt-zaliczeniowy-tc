import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";

import API_BASE_URL from "./config";

// Jezeli uzytkownik nie jest zalogowany, idz do panelu logowania
function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Jezeli uzytkownik jest zalogowany, idz do dashboardu
function PublicRoute({ user, children }) {
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("TOKEN:", token);

    if (!token) {
      setAuthChecked(true);
      return;
    }

    fetch(`${API_BASE_URL}/auth/verifytoken`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        //console.log("AUTH /me status:", res.status);

        if (!res.ok) {
          throw new Error("Nieprawidlowy token");
        }

        const data = await res.json();
        //console.log("AUTH /me data:", data);
        return data;
      })
      .then((data) => {
        setUser(data.user);
      })
      .catch((err) => {
        //console.error("AUTH ERROR:", err);
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => {
        setAuthChecked(true);
      });
  }, []);

  if (!authChecked) {
    return <p>Ładowanie</p>;
  }
  
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}

        <Route path="/login" element={<Navigate to="/" replace />} />

        <Route
          path="/"
          element={
            <PublicRoute user={user}>
              <Login setUser={setUser} />
            </PublicRoute>
          }
        />

        {/* REGISTER */}
        <Route
          path="/register"
          element={
            <PublicRoute user={user}>
              <Register setUser={setUser} />
            </PublicRoute>
          }
        />

        {/* DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user}>
              <Dashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          }
        />

        {/* DEFAULT */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
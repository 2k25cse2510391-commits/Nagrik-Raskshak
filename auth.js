/* ================= CONFIGURATION ================= */

// 👇 PASTE YOUR RENDER URL HERE (No trailing slash)
const API_BASE_URL = "https://nagrik-raskshak.onrender.com";

// Use this one if you are testing locally on your laptop:
// const API_BASE_URL = "http://localhost:3000"; 


/* ================= PANEL SWITCH ================= */

function switchPanel() {
  const signup = document.getElementById("signup");
  const login = document.getElementById("login");

  if (signup.classList.contains("active")) {
    signup.classList.remove("active");
    signup.classList.add("exit");

    login.classList.remove("exit");
    login.classList.add("active");
  } else {
    login.classList.remove("active");
    login.classList.add("exit");

    signup.classList.remove("exit");
    signup.classList.add("active");
  }
}

/* ================= OPEN FROM HEADER ================= */

function openLogin() {
  window.location.href = "auth.html?mode=login";
}

function openSignup() {
  window.location.href = "auth.html?mode=signup";
}

/* ================= PAGE LOAD ================= */

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");

  const signup = document.getElementById("signup");
  const login = document.getElementById("login");

  signup.classList.remove("active", "exit");
  login.classList.remove("active", "exit");

  if (mode === "login") {
    login.classList.add("active");
  } else {
    signup.classList.add("active");
  }
});

/* ================= REGISTER ================= */

async function register() {
  const name = document.getElementById("su-name").value.trim();
  const email = document.getElementById("su-email").value.trim();
  const password = document.getElementById("su-password").value.trim();

  if (!name || !email || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    // UPDATED: Uses API_BASE_URL instead of localhost
    const res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "index.html";
    } else {
      alert(data.message || "Signup failed");
    }
  } catch (error) {
    console.error("Register Error:", error);
    alert("Failed to connect to server. Please try again.");
  }
}

/* ================= LOGIN ================= */

async function login() {
  const email = document.getElementById("li-email").value.trim();
  const password = document.getElementById("li-password").value.trim();

  if (!email || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    // UPDATED: Uses API_BASE_URL instead of localhost
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "index.html";
    } else {
      alert("Invalid login");
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("Failed to connect to server. Please try again.");
  }
}

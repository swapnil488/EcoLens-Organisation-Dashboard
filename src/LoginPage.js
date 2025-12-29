import React, { useState } from "react";
import { auth } from "./firebase"; // Adjust path as necessary
import { signInWithEmailAndPassword } from "firebase/auth"; // Import the modular function
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");       // using email for login
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const login = () => {
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        return userCredential.user.getIdTokenResult();
      })
      .then((idTokenResult) => {
        if (idTokenResult.claims.organisation_user) {
          // Redirect to admin dashboard
          navigate("/home");
        } else {
          auth.signOut();
          showPopupMessage("Organisation User access required");
        }
      })
      .catch((error) => {
        showPopupMessage(error.message);
      });
  };

  const showPopupMessage = (message) => {
    setPopupMessage(message);
    setShowPopup(true);
  };

  const closePopup = () => {
    setShowPopup(false);
  };

  return (
    <div className="login-page">
      <div className="container">
        <h1>Login Page</h1>
        <div className="input-group">
          <input
            type="email"
            id="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <span className="icon">✉️</span>
        </div>
        <div className="input-group">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span className="icon" onClick={togglePassword}>
            👁️
          </span>
        </div>
        <button className="login-btn" onClick={login}>
          Login
        </button>
      </div>

      {showPopup && (
        <div className="popup">
          <p>{popupMessage}</p>
          <button onClick={closePopup}>OK</button>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
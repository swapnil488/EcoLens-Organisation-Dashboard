// UpdateReportForm.js
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import "./UpdateReportForm.css";

const UpdateReportForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [newDescription, setNewDescription] = useState("");
  const [file, setFile] = useState(null); // single file only
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(undefined);

  // Auth listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  // Early UI while auth state undetermined
  if (currentUser === undefined) return null;

  // Not authenticated
  if (!currentUser) {
    return (
      <div className="update-report-form">
        <div className="error-message">
          <h1>You don't have permission to view this page</h1>
        </div>
      </div>
    );
  }

  // handle file input (single image only)
  const handleFileChange = (e) => {
    setError(null);
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    // Validate MIME type: must be image/*
    if (!f.type || !f.type.startsWith("image/")) {
      setError("Please upload a valid image file (PNG, JPG, JPEG, GIF, etc.).");
      setFile(null);
      setPreviewUrl(null);
      e.target.value = "";
      return;
    }

    // Optional: limit file size (e.g., 8MB)
    const MAX_BYTES = 8 * 1024 * 1024;
    if (f.size > MAX_BYTES) {
      setError("Image too large — please choose an image under 8 MB.");
      setFile(null);
      setPreviewUrl(null);
      e.target.value = "";
      return;
    }

    setFile(f);

    // create preview
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!newDescription.trim()) {
      setError("Description cannot be empty.");
      return;
    }
    if (!file) {
      setError("Please upload one image file.");
      return;
    }

    setIsLoading(true);
    setUploadProgressText("Uploading image...");

    try {
      // Upload image to Firebase Storage
      const safeName = file.name.replace(/\s+/g, "_");
      const storageRef = ref(storage, `reports/${id}/resolved_photo_${Date.now()}_${safeName}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      setUploadProgressText("Updating report...");

      // Update Firestore document — DO NOT overwrite existing photoUrl.
      // Instead add a new field 'resolvedPhotoUrl' (single-image canonical field for resolved photo)
      const reportRef = doc(db, "reports", id);
      await updateDoc(reportRef, {
        status: "resolved",
        resolvedPhotoUrl: downloadUrl, // new field only
        resolutionDescription: newDescription,
        resolvedBy: currentUser.uid || currentUser.email || null,
        resolvedAt: serverTimestamp(),
      });

      // success — navigate back to dashboard
      navigate("/home");
    } catch (err) {
      console.error("Error updating report:", err);
      setError("Failed to update report. Please try again.");
    } finally {
      setIsLoading(false);
      setUploadProgressText("");
    }
  };

  const removeSelectedImage = () => {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    // native file input clearing handled by re-render / user can reselect
  };

  return (
    <div className="update-report-form">
      <div className="card">
        <h2>Resolve Report</h2>

        <form onSubmit={handleSubmit} className="form">
          {error && <div className="form-error">{error}</div>}

          <label className="label">New Description</label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Describe the resolution or action taken..."
            rows={5}
            required
          />

          <label className="label">Upload Resolved Photo (one image only)</label>
          <div className="file-row">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              id="resolvedPhoto"
            />
            {previewUrl && (
              <div className="preview-wrap">
                <img src={previewUrl} alt="preview" className="preview-img" />
                <button type="button" className="remove-btn" onClick={removeSelectedImage}>
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="actions">
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? "Updating..." : "Submit"}
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => navigate("/home")}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>

          {uploadProgressText && <div className="progress-text">{uploadProgressText}</div>}
        </form>
      </div>
    </div>
  );
};

export default UpdateReportForm;

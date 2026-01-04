// ReportDetails.jsx
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase"; // Firestore and Auth instance
import { useParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import "./ReportDetails.css";

const ReportDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null); // only set when user clicks
  const [currentUser, setCurrentUser] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Track broken state separately for reported and resolved images
  const [brokenReportedImage, setBrokenReportedImage] = useState(false);
  const [brokenResolvedImage, setBrokenResolvedImage] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch report (only when auth determined and user logged in)
  useEffect(() => {
    if (currentUser === undefined) return; // still checking
    if (!currentUser) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchReport = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const docRef = doc(db, "reports", id);
        const docSnap = await getDoc(docRef);
        if (cancelled) return;
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setReport(data);
          // DO NOT auto-open preview — user must click image to view popup
        } else {
          setFetchError("Report not found.");
        }
      } catch (err) {
        setFetchError(err.message || "Failed to fetch report");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [id, currentUser]);

  // Helper: extract image URLs from various possible fields
  const extractImageUrls = (rpt) => {
    if (!rpt) return [];
    // 1) canonical: photoUrls (array)
    if (Array.isArray(rpt.photoUrls) && rpt.photoUrls.length > 0) {
      return rpt.photoUrls.filter(Boolean).map((u) => String(u));
    }
    // 2) single canonical: photoUrl (string)
    if (rpt.photoUrl && typeof rpt.photoUrl === "string" && rpt.photoUrl.trim()) {
      return [rpt.photoUrl.trim()];
    }
    // 3) fallbacks: check any key that looks like photo/image/url
    const urls = [];
    Object.keys(rpt).forEach((k) => {
      const v = rpt[k];
      if (/photo|image|img|picture/i.test(k)) {
        if (Array.isArray(v)) {
          v.forEach((x) => { if (x) urls.push(String(x)); });
        } else if (typeof v === "string" && v.trim()) {
          urls.push(v.trim());
        }
      }
      // also accept keys containing 'url' that are strings
      if (/url/i.test(k) && typeof v === "string" && v.trim()) {
        if (!urls.includes(v.trim())) urls.push(v.trim());
      }
    });
    return urls;
  };

  const openLocationInMaps = () => {
    if (report && report.latitude && report.longitude) {
      window.open(
        `https://maps.google.com/maps?q=${report.latitude},${report.longitude}&z=15`,
        "_blank"
      );
    }
  };

  // Do not render content until the auth state is determined
  if (currentUser === undefined || loading) {
    return <div className="report-details"><p>Loading...</p></div>;
  }

  // If no user is authenticated, display an error message
  if (!currentUser) {
    return (
      <div className="report-details">
        <div className="error-message">
          <h1>You don't have permission to view this page</h1>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="report-details">
        <div className="error-message">
          <h1>Error</h1>
          <p>{fetchError}</p>
        </div>
      </div>
    );
  }

  // Render loading placeholder until report loaded
  if (!report) return <div className="report-details"><p>Loading report...</p></div>;

  // Report images (original reported)
  const reportedImages = extractImageUrls(report);
  const reportedMain = reportedImages.length > 0 ? reportedImages[0] : null;

  // Resolved image (new field) — prefer resolvedPhotoUrl if present
  const resolvedImage = report.resolvedPhotoUrl && typeof report.resolvedPhotoUrl === "string"
    ? report.resolvedPhotoUrl
    : null;

  return (
    <div className="report-details">
      <h1>Report Details</h1>

      <div className="detail-row">
        <strong>Report ID:</strong> <span>{report.id}</span>
      </div>

      <div className="detail-row">
        <strong>Title:</strong> <span>{report.title || "-"}</span>
      </div>

      <div className="detail-row">
        <strong>Description:</strong> <span>{report.description || "-"}</span>
      </div>

      <div className="detail-row">
        <strong>Category:</strong> <span>{report.category || "-"}</span>
      </div>

      <div className="detail-row">
        <strong>Model Category:</strong> <span>{report.modelCategory || "-"}</span>
      </div>

      <div className="detail-row">
        <strong>Severity:</strong> <span>{report.severity || "-"}</span>
      </div>

      <div className="detail-row">
        <strong>Pincode:</strong> <span>{report.pincode || "-"}</span>
      </div>

      <div className="detail-row">
        <strong>Location:</strong>
        <div
          className="map-container"
          onClick={openLocationInMaps}
          title="Click to open in Google Maps"
        >
          {report.latitude && report.longitude ? (
            <iframe
              title="Report Location"
              src={`https://maps.google.com/maps?q=${report.latitude},${report.longitude}&z=15&output=embed`}
              frameBorder="0"
              style={{ width: "100%", height: "300px", border: 0 }}
              allowFullScreen=""
              aria-hidden="false"
              tabIndex="0"
            />
          ) : (
            <div style={{ padding: 12 }}>No coordinates available</div>
          )}
        </div>
      </div>

      {/* Reported Photo(s) */}
      <div className="detail-row">
        <strong>Reported Photo:</strong>
        <div className="images-container">
          {reportedMain ? (
            <>
              <img
                src={reportedMain}
                alt={`Report ${report.id}`}
                className="report-main-image"
                onClick={() => {
                  setBrokenReportedImage(false);
                  setSelectedImage(reportedMain);
                }}
                onError={() => setBrokenReportedImage(true)}
              />
              {brokenReportedImage && (
                <div className="image-error">Reported image could not be loaded.</div>
              )}
            </>
          ) : (
            <span>No Images</span>
          )}
        </div>
      </div>

      {/* If resolved, show resolved photo + resolution description */}
      {report.status === "resolved" && (
        <>
          <div className="detail-row">
            <strong>Resolved Photo:</strong>
            <div className="images-container">
              {resolvedImage ? (
                <>
                  <img
                    src={resolvedImage}
                    alt={`Resolved ${report.id}`}
                    className="report-main-image"
                    onClick={() => {
                      setBrokenResolvedImage(false);
                      setSelectedImage(resolvedImage);
                    }}
                    onError={() => setBrokenResolvedImage(true)}
                  />
                  {brokenResolvedImage && (
                    <div className="image-error">Resolved image could not be loaded.</div>
                  )}
                </>
              ) : (
                <span>No Resolved Photo</span>
              )}
            </div>
          </div>

          <div className="detail-row">
            <strong>Resolution Description:</strong>
            <span>{report.resolutionDescription || report.newDescription || "-"}</span>
          </div>
        </>
      )}

      <div className="detail-row">
        <strong>Status:</strong>{" "}
        <span
          style={{
            color:
              report.status === "pending"
                ? "red"
                : report.status === "resolved"
                ? "green"
                : "inherit",
          }}
        >
          {report.status || "-"}
        </span>
        {report.status === "pending" && (
          <button
            className="update-status-btn"
            onClick={() => navigate(`/update-report/${id}`)}
          >
            Update Status
          </button>
        )}
      </div>

      {/* Popup viewer (open only when selectedImage set by click) */}
      {selectedImage && (
        <div className="popup-overlay" onClick={() => setSelectedImage(null)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage}
              alt="Detailed view"
              className="popup-image"
              onError={() => {
                // mark both flags if this is unknown (best-effort)
                if (reportedMain === selectedImage) setBrokenReportedImage(true);
                if (resolvedImage === selectedImage) setBrokenResolvedImage(true);
              }}
            />
            <button className="close-btn" onClick={() => setSelectedImage(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportDetails;

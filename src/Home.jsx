// Home.js
import React, { useEffect, useState, useMemo } from "react";
import {
  onSnapshot,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db, auth } from "./firebase"; // make sure db and auth are exported from your firebase.js
import { useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import "./Home.css";

const Home = () => {
  const [reportsFetched, setReportsFetched] = useState([]); // raw reports after org pincode filtering from Firestore
  const [reports, setReports] = useState([]); // reports after applying UI filters & sorting
  const [currentUser, setCurrentUser] = useState(undefined); // undefined while checking auth
  const [orgPincodes, setOrgPincodes] = useState(null); // null = loading, [] = none found
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const navigate = useNavigate();

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | resolved
  const [pincodeFilter, setPincodeFilter] = useState("all"); // 'all' or specific pincode
  const [dateSort, setDateSort] = useState("desc"); // desc | asc
  const [severityFilter, setSeverityFilter] = useState({
    Mild: true,
    Moderate: true,
    Severe: true,
  }); // which severities to include

  // Listen for authentication state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch organisation pincodes (by matching email in 'pincodes' or 'organisations' collections)
  useEffect(() => {
    if (currentUser === undefined) return;

    if (!currentUser) {
      setOrgPincodes([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchOrgPincodes = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        // Try 'pincodes' collection first
        const pincodesQ = query(
          collection(db, "pincodes"),
          where("email", "==", currentUser.email)
        );
        const pincodesSnap = await getDocs(pincodesQ);

        if (!cancelled && !pincodesSnap.empty) {
          const doc = pincodesSnap.docs[0].data();
          const arr = Array.isArray(doc.pincodes) ? doc.pincodes : [];
          setOrgPincodes(arr.map((p) => String(p).trim()));
          setLoading(false);
          return;
        }

        // Fallback to 'organisations' collection
        const orgQ = query(
          collection(db, "organisations"),
          where("email", "==", currentUser.email)
        );
        const orgSnap = await getDocs(orgQ);
        if (!cancelled && !orgSnap.empty) {
          const doc = orgSnap.docs[0].data();
          const arr = Array.isArray(doc.pincodes) ? doc.pincodes : [];
          setOrgPincodes(arr.map((p) => String(p).trim()));
          setLoading(false);
          return;
        }

        if (!cancelled) {
          setOrgPincodes([]);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err.message || "Failed to load organisation pincodes");
          setOrgPincodes([]);
          setLoading(false);
        }
      }
    };

    fetchOrgPincodes();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // Subscribe to reports collection, then filter server-side by org's pincodes
  useEffect(() => {
    if (currentUser === undefined || orgPincodes === null) return;
    if (!currentUser) {
      setReportsFetched([]);
      return;
    }

    const unsub = onSnapshot(
      collection(db, "reports"),
      (snapshot) => {
        const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // If org has no pincodes configured, show empty list
        if (!Array.isArray(orgPincodes) || orgPincodes.length === 0) {
          setReportsFetched([]);
          return;
        }

        const filteredByOrg = all.filter((r) => {
          if (!r.pincode) return false;
          try {
            const rp = String(r.pincode).trim();
            return orgPincodes.includes(rp);
          } catch {
            return false;
          }
        });

        // sort by timestamp descending by default for raw set
        filteredByOrg.sort((a, b) => getTimestampMillis(b.timestamp) - getTimestampMillis(a.timestamp));
        setReportsFetched(filteredByOrg);
      },
      (err) => {
        console.error("Reports snapshot error:", err);
        setFetchError(err.message || "Failed to load reports");
      }
    );

    return () => unsub();
  }, [currentUser, orgPincodes]);

  // Apply UI filters and sorting whenever reportsFetched or any filter changes
  useEffect(() => {
    const apply = () => {
      let arr = [...reportsFetched];

      // Status filter
      if (statusFilter !== "all") {
        arr = arr.filter((r) => {
          const s = (r.status || "").toString().toLowerCase();
          return s === statusFilter.toLowerCase();
        });
      }

      // Pincode filter (UI level within org pincodes)
      if (pincodeFilter !== "all") {
        arr = arr.filter((r) => String(r.pincode).trim() === String(pincodeFilter).trim());
      }

      // Severity filter (multi-select). If all disabled -> show none.
      const selectedSev = Object.keys(severityFilter).filter((k) => severityFilter[k]);
      if (selectedSev.length > 0 && selectedSev.length < Object.keys(severityFilter).length) {
        arr = arr.filter((r) => {
          const sev = (r.severity || "").toString();
          return selectedSev.includes(sev);
        });
      } else if (selectedSev.length === 0) {
        // none selected -> empty list
        arr = [];
      }

      // Date sorting
      arr.sort((a, b) => {
        const ta = getTimestampMillis(a.timestamp);
        const tb = getTimestampMillis(b.timestamp);
        return dateSort === "asc" ? ta - tb : tb - ta;
      });

      setReports(arr);
    };

    apply();
  }, [reportsFetched, statusFilter, pincodeFilter, dateSort, severityFilter]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Helpers
  const getTimestampMillis = (timestamp) => {
    if (!timestamp) return 0;
    if (typeof timestamp === "object" && typeof timestamp.toDate === "function") {
      return timestamp.toDate().getTime();
    }
    if (timestamp && typeof timestamp.seconds === "number") {
      return timestamp.seconds * 1000 + (timestamp.nanoseconds ? timestamp.nanoseconds / 1e6 : 0);
    }
    if (typeof timestamp === "string") {
      const t = new Date(timestamp);
      if (!isNaN(t)) return t.getTime();
      return 0;
    }
    if (typeof timestamp === "number") return timestamp;
    return 0;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    if (typeof timestamp === "string") return timestamp;
    if (typeof timestamp === "object" && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleString();
    }
    if (timestamp && typeof timestamp.seconds === "number") {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    if (typeof timestamp === "number") {
      return new Date(timestamp).toLocaleString();
    }
    return String(timestamp);
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setPincodeFilter("all");
    setDateSort("desc");
    setSeverityFilter({ Mild: true, Moderate: true, Severe: true });
  };

  const toggleSeverity = (sev) => {
    setSeverityFilter((prev) => ({ ...prev, [sev]: !prev[sev] }));
  };

  // UI while auth/pincode loading
  if (currentUser === undefined || orgPincodes === null || loading) {
    return (
      <div className="home-page">
        <div className="loader">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="home-page">
        <div className="error-message">
          <h1>You don't have permission to view this page</h1>
        </div>
      </div>
    );
  }

  // Build pincode options for UI from orgPincodes
  const pincodeOptions = Array.isArray(orgPincodes) ? orgPincodes : [];

  return (
    <div className="home-page">
      <header>
        <div className="header-left">
          <strong>{currentUser.email}</strong>
        </div>
        <div className="header-right">
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <h1>Reports Dashboard</h1>

      <div className="org-info">
        <h3>Organisation pincodes under your jurisdiction</h3>
        {fetchError && <div className="fetch-error">Error: {fetchError}</div>}
        {pincodeOptions.length > 0 ? (
          <div className="pincode-list">
            {pincodeOptions.map((p) => (
              <span key={p} className="pincode-pill">
                {p}
              </span>
            ))}
          </div>
        ) : (
          <div className="no-pincodes">
            No pincodes configured for your organisation. Contact admin to configure.
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="filters-panel">
        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Pincode</label>
          <select value={pincodeFilter} onChange={(e) => setPincodeFilter(e.target.value)}>
            <option value="all">All (Your jurisdiction)</option>
            {pincodeOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Date & Time</label>
          <select value={dateSort} onChange={(e) => setDateSort(e.target.value)}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>

        <div className="filter-group severity-group">
          <label>Severity</label>
          <div className="severity-checkboxes">
            {["Mild", "Moderate", "Severe"].map((s) => (
              <label key={s} className="sev-item">
                <input
                  type="checkbox"
                  checked={!!severityFilter[s]}
                  onChange={() => toggleSeverity(s)}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-actions">
          <button className="reset-btn" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {reports.length === 0 ? (
          <div className="no-reports">No reports found for selected filters.</div>
        ) : (
          <table className="reports-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Title</th>
                <th>Uploaded By</th>
                <th>Pincode</th>
                <th>Severity</th>
                <th>Date and Time</th>
                <th>Status</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="id-cell" title={report.id}>
                    {report.id.slice(0, 8)}...
                  </td>
                  <td>{report.title || "-"}</td>
                  <td>{report.userName || report.uid || "-"}</td>
                  <td>{report.pincode || "-"}</td>
                  <td>{report.severity || "-"}</td>
                  <td>{formatTimestamp(report.timestamp)}</td>
                  <td
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
                  </td>
                  <td>
                    <button
                      className="view-btn"
                      onClick={() => navigate(`/report/${report.id}`)}
                      title="View Report"
                    >
                      👁️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Home;

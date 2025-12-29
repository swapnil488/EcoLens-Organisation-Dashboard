import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import Home from './Home';
import ReportDetails from './ReportDetails';
import UpdateReportForm from './UpdateReportForm'; // Add this import

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/report/:id" element={<ReportDetails />} />
        <Route path="/update-report/:id" element={<UpdateReportForm />} /> {/* Add this route */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);



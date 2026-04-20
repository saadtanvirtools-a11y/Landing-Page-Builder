import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import React    from "react";
import ReactDOM from "react-dom/client";
import './index.css'
import App from './App.tsx'
import { seedAdminIfNeeded } from "./api/auth";

// ✅ Seed admin account to Firestore on first load
seedAdminIfNeeded();

createRoot(document.getElementById('root')!).render(
   <StrictMode>
    <App />
  </StrictMode>,
);
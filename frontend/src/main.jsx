import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { RegionProvider } from "./context/RegionProvider.jsx";
import "leaflet/dist/leaflet.css";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RegionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RegionProvider>
  </React.StrictMode>
);
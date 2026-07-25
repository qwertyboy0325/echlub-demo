import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

const root = document.querySelector("#app");
if (!root) throw new Error("#app not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const fallback = document.getElementById("boot-fallback");
if (fallback) fallback.hidden = true;

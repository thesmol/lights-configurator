import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
const root = document.getElementById("app");
if (!root) throw new Error("Application root not found");
createRoot(root).render(<App />);

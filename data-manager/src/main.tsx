import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import BackToTopButton from "./components/BackToTopButton";

ReactDOM.createRoot(
  document.getElementById(
    "root",
  ) as HTMLElement,
).render(
  <React.StrictMode>
    <App />
    <BackToTopButton />
  </React.StrictMode>,
);
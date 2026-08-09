
  import { createRoot } from "react-dom/client";
  import App, { AppErrorBoundary } from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
  

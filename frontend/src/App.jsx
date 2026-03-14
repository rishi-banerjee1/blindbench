import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Arena from "./pages/Arena";
import Leaderboard from "./pages/Leaderboard";
import AllModels from "./pages/AllModels";
import FailureExplorer from "./pages/FailureExplorer";
import Analytics from "./pages/Analytics";
import DatasetExplorer from "./pages/DatasetExplorer";
import Insights from "./pages/Insights";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/all-models" element={<AllModels />} />
        <Route path="/failures" element={<FailureExplorer />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/dataset" element={<DatasetExplorer />} />
        <Route path="/insights" element={<Insights />} />
      </Route>
    </Routes>
  );
}

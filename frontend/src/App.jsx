import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Arena from "./pages/Arena";
import Leaderboard from "./pages/Leaderboard";
import FailureExplorer from "./pages/FailureExplorer";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/failures" element={<FailureExplorer />} />
      </Route>
    </Routes>
  );
}

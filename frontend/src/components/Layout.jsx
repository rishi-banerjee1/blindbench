import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/arena", label: "Arena" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/failures", label: "Failures" },
  { to: "/insights", label: "Insights" },
  { to: "/analytics", label: "Analytics" },
  { to: "/dataset", label: "Dataset" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-bold tracking-tight">
            <span className="text-amber-400">Blind</span>Bench
          </NavLink>
          <nav className="flex gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-400/10 text-amber-400"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-gray-800 py-6 text-center text-sm text-gray-500">
        BlindBench — Evaluating LLM trustworthiness through blind
        comparison
      </footer>
    </div>
  );
}

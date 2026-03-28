/**
 * Dashboard CSS — embedded in the HTML layout.
 * Responsive sidebar that collapses to a top hamburger menu on mobile.
 */
export const DASHBOARD_CSS = /* css */ `
  :root {
    --sidebar-width: 240px;
    --sidebar-bg: #111827;
    --sidebar-text: #d1d5db;
    --sidebar-active: #6366f1;
    --sidebar-hover: #1f2937;
    --header-height: 56px;
    --bg: #f9fafb;
    --card-bg: #ffffff;
    --border: #e5e7eb;
    --text-primary: #111827;
    --text-secondary: #6b7280;
    --accent: #6366f1;
    --accent-light: #eef2ff;
    --radius: 8px;
    --shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      'Helvetica Neue', Arial, sans-serif;
    background: var(--bg);
    color: var(--text-primary);
    min-height: 100vh;
  }

  /* ── Sidebar ──────────────────────────────────────────── */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: var(--sidebar-width);
    height: 100vh;
    background: var(--sidebar-bg);
    color: var(--sidebar-text);
    display: flex;
    flex-direction: column;
    z-index: 100;
    transition: transform 0.25s ease;
  }

  .sidebar-brand {
    padding: 16px 20px;
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 1.5px;
    border-bottom: 1px solid #1f2937;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sidebar-brand span {
    color: var(--accent);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .sidebar-nav a {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    color: var(--sidebar-text);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
    border-left: 3px solid transparent;
  }

  .sidebar-nav a:hover {
    background: var(--sidebar-hover);
    color: #ffffff;
  }

  .sidebar-nav a.active {
    background: rgba(99,102,241,0.12);
    color: #a5b4fc;
    border-left-color: var(--sidebar-active);
  }

  .sidebar-nav .nav-icon {
    width: 20px;
    text-align: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  .sidebar-section {
    padding: 18px 20px 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #4b5563;
    font-weight: 600;
  }

  .sidebar-footer {
    padding: 12px 20px;
    border-top: 1px solid #1f2937;
    font-size: 12px;
    color: #4b5563;
  }

  /* ── Main content ─────────────────────────────────────── */
  .main {
    margin-left: var(--sidebar-width);
    min-height: 100vh;
  }

  .topbar {
    height: var(--header-height);
    background: var(--card-bg);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .topbar-title {
    font-size: 18px;
    font-weight: 600;
  }

  .topbar-env {
    font-size: 12px;
    padding: 4px 10px;
    background: var(--accent-light);
    color: var(--accent);
    border-radius: 12px;
    font-weight: 600;
  }

  .hamburger {
    display: none;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-primary);
    padding: 4px 8px;
  }

  .content {
    padding: 24px;
    max-width: 1200px;
  }

  /* ── Empty state ──────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    text-align: center;
  }

  .empty-state-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-state h2 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-secondary);
    max-width: 400px;
    line-height: 1.6;
  }

  /* ── Cards ────────────────────────────────────────────── */
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
    margin-bottom: 16px;
  }

  .card-header {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }

  .stat-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
    text-align: center;
  }

  .stat-card .stat-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--accent);
  }

  .stat-card .stat-label {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  /* ── Breadcrumb ───────────────────────────────────────── */
  .breadcrumb {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }

  .breadcrumb a {
    color: var(--accent);
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .breadcrumb span {
    margin: 0 6px;
  }

  /* ── Table ────────────────────────────────────────────── */
  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th {
    text-align: left;
    padding: 10px 12px;
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 2px solid var(--border);
  }

  td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }

  tr:hover td {
    background: #f3f4f6;
  }

  /* ── Badge ────────────────────────────────────────────── */
  .badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .badge-active {
    background: #d1fae5;
    color: #065f46;
  }

  .badge-sleeping {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-free {
    background: #dbeafe;
    color: #1e40af;
  }

  .badge-paid {
    background: #ede9fe;
    color: #5b21b6;
  }

  /* ── Overlay for mobile ───────────────────────────────── */
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 90;
  }

  /* ── Responsive ───────────────────────────────────────── */
  @media (max-width: 768px) {
    .sidebar {
      transform: translateX(-100%);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .sidebar-overlay.open {
      display: block;
    }

    .main {
      margin-left: 0;
    }

    .hamburger {
      display: block;
    }

    .content {
      padding: 16px;
    }

    .card-grid {
      grid-template-columns: 1fr;
    }
  }
`;

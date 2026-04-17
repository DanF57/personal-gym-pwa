import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSyncStatus } from '../hooks/useSyncStatus'
import './Layout.css'

const tabs = [
  {
    to: '/',
    label: 'Log',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  },
  {
    to: '/routines',
    label: 'Routines',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    )
  },
  {
    to: '/history',
    label: 'History',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )
  },
  {
    to: '/progress',
    label: 'Progress',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    )
  },
  {
    to: '/exercises',
    label: 'Exercises',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5h11M6.5 17.5h11M2 12h4M18 12h4M6 6.5v11M18 6.5v11" />
      </svg>
    )
  }
]

function formatTimeAgo(timestamp) {
  if (!timestamp) return null
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function SyncIndicator() {
  const { status, lastSyncedAt, error } = useSyncStatus()
  const [, setTick] = useState(0)

  // Re-render every 30s to keep "Xm ago" fresh
  useState(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  })

  if (status === 'offline') {
    return (
      <div className="sync-indicator sync-offline" title="No internet connection">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
          <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0122.56 9" />
          <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
          <path d="M8.53 16.11a6 6 0 016.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span>Offline</span>
      </div>
    )
  }

  if (status === 'syncing') {
    return (
      <div className="sync-indicator sync-active" title="Syncing data...">
        <div className="sync-spinner" />
        <span>Syncing</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="sync-indicator sync-error" title={error || 'Sync failed'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Sync error</span>
      </div>
    )
  }

  if (status === 'synced' && lastSyncedAt) {
    return (
      <div className="sync-indicator sync-ok" title={`Last synced ${formatTimeAgo(lastSyncedAt)}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{formatTimeAgo(lastSyncedAt)}</span>
      </div>
    )
  }

  return null
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="layout">
      <header className="top-bar">
        <span className="top-bar-title">Gym Tracker</span>
        <SyncIndicator />
        <button className="user-btn" onClick={() => setMenuOpen(!menuOpen)}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="" className="user-avatar" />
          ) : (
            <span className="user-avatar-fallback">
              {(user?.email || '?')[0].toUpperCase()}
            </span>
          )}
        </button>
        {menuOpen && (
          <div className="user-menu fade-in" onClick={() => setMenuOpen(false)}>
            <div className="user-menu-info">
              <span className="user-menu-name">{user?.user_metadata?.full_name || 'User'}</span>
              <span className="user-menu-email">{user?.email}</span>
            </div>
            <button className="user-menu-item" onClick={signOut}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </header>
      <main className="layout-content">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

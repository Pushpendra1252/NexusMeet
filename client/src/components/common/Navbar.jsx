import React, { useState, useEffect } from 'react';
import { Video, Settings, HelpCircle, ShieldCheck, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar = ({ onOpenSettings }) => {
  const [currentTime, setCurrentTime] = useState('');
  const [apiStatus, setApiStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [apiDetails, setApiDetails] = useState(null);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      setCurrentTime(`${timeStr} • ${dateStr}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Health check to backend API
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';
        const res = await fetch(`${apiUrl}/health`);
        if (res.ok) {
          const data = await res.json();
          setApiStatus('online');
          setApiDetails(data);
        } else {
          setApiStatus('offline');
        }
      } catch (err) {
        setApiStatus('offline');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-dark-border bg-dark-bg/80 backdrop-blur-md px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-400 flex items-center justify-center shadow-glow-primary group-hover:scale-105 transition-transform duration-200">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white">Nexus<span className="text-primary-500">Meet</span></span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-400 border border-primary-500/20">v1.0</span>
            </div>
            <p className="text-[11px] text-dark-muted hidden sm:block">Ultra-low latency collaboration</p>
          </div>
        </Link>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Real-time Clock */}
          <div className="hidden md:flex text-sm font-medium text-slate-300 items-center gap-2">
            <span>{currentTime}</span>
          </div>

          {/* Backend API Status Pill */}
          <div 
            className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
            title={apiDetails ? `${apiDetails.service} (${apiDetails.phase})` : 'Backend API check'}
          >
            {apiStatus === 'online' ? (
              <span className="flex items-center gap-1.5 text-accent-emerald bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                Backend API Online
              </span>
            ) : apiStatus === 'checking' ? (
              <span className="flex items-center gap-1.5 text-accent-amber bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-accent-amber animate-ping" />
                Connecting API...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-accent-rose bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-accent-rose" />
                API Offline
              </span>
            )}
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-card border border-transparent hover:border-dark-border transition-all"
            aria-label="Application Settings"
            title="Settings & Audio/Video Preferences"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* User Profile Placeholder */}
          <div className="flex items-center gap-2 pl-2 border-l border-dark-border">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm border border-white/10 shadow-sm">
                PD
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent-emerald border-2 border-dark-bg" title="Online" />
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-white">Pushpendra</div>
              <div className="text-[10px] text-dark-muted">Local Session</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

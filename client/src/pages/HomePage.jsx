import React, { useState } from 'react';
import { 
  Video, 
  Keyboard, 
  Plus, 
  Calendar, 
  Link as LinkIcon, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Users, 
  Clock,
  Laptop,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import { NewMeetingModal } from '../components/common/NewMeetingModal';

// Helper to generate realistic meeting codes like "nex-842-q9m"
const generateMeetingCode = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `nex-${segment(3)}-${segment(3)}`;
};

export const HomePage = () => {
  const [meetingCodeInput, setMeetingCodeInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNewMeetingModalOpen, setIsNewMeetingModalOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming');
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Handle Join button
  const handleJoinMeeting = (e) => {
    e.preventDefault();
    const cleanCode = meetingCodeInput.trim().replace(/^https?:\/\/[^\/]+\/room\//, '');
    if (!cleanCode) {
      addToast('Please enter a valid meeting code or link', 'warning');
      return;
    }
    navigate(`/room/${cleanCode}`);
  };

  // Start instant meeting
  const handleStartInstantMeeting = () => {
    const code = generateMeetingCode();
    setIsDropdownOpen(false);
    navigate(`/room/${code}`);
  };

  // Create meeting for later
  const handleCreateMeetingForLater = () => {
    const code = generateMeetingCode();
    setGeneratedCode(code);
    setIsDropdownOpen(false);
    setIsNewMeetingModalOpen(true);
  };

  // Schedule for later
  const handleScheduleMeeting = () => {
    setIsDropdownOpen(false);
    addToast('Calendar sync will be enabled in Phase 2 with database integration.', 'info');
  };

  return (
    <div className="relative min-h-[calc(100vh-68px)] flex flex-col justify-between overflow-hidden">
      {/* Background ambient lighting accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary-600/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[300px] bg-accent-emerald/5 blur-[120px] pointer-events-none rounded-full" />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 lg:py-16 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          
          {/* Left Column: Hero & Action Controls */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            {/* Version / Feature Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-300">
              <Sparkles className="w-3.5 h-3.5 text-primary-400" />
              <span>Modern WebRTC Video Experience</span>
            </div>

            {/* Hero Headlines */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
                Video meetings <br />
                <span className="bg-gradient-to-r from-primary-400 via-indigo-300 to-accent-emerald bg-clip-text text-transparent">
                  built for modern teams.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
                Connect, present, and collaborate with crystal-clear audio, HD video, and real-time screen sharing. Fully encrypted and zero installations needed.
              </p>
            </div>

            {/* Action Bar (New Meeting + Join Input) */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 max-w-xl mx-auto lg:mx-0">
              {/* New Meeting Dropdown */}
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm shadow-glow-primary hover:shadow-primary-500/50 transition-all duration-200"
                >
                  <Video className="w-4 h-4" />
                  <span>New meeting</span>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsDropdownOpen(false)} 
                    />
                    <div className="absolute left-0 sm:left-0 top-full mt-2 w-64 glass-dropdown rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 border border-dark-border">
                      <button
                        onClick={handleCreateMeetingForLater}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold text-slate-200 hover:text-white hover:bg-dark-hover transition-colors"
                      >
                        <LinkIcon className="w-4 h-4 text-primary-400" />
                        <div>
                          <div>Create a meeting for later</div>
                          <div className="text-[10px] text-dark-muted font-normal">Get a shareable link</div>
                        </div>
                      </button>

                      <button
                        onClick={handleStartInstantMeeting}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold text-slate-200 hover:text-white hover:bg-dark-hover transition-colors"
                      >
                        <Plus className="w-4 h-4 text-accent-emerald" />
                        <div>
                          <div>Start an instant meeting</div>
                          <div className="text-[10px] text-dark-muted font-normal">Enter room preview immediately</div>
                        </div>
                      </button>

                      <button
                        onClick={handleScheduleMeeting}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold text-slate-200 hover:text-white hover:bg-dark-hover transition-colors border-t border-dark-border/60 mt-1"
                      >
                        <Calendar className="w-4 h-4 text-accent-cyan" />
                        <div>
                          <div>Schedule for later</div>
                          <div className="text-[10px] text-dark-muted font-normal">Plan ahead with calendar sync</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Join Meeting Input Form */}
              <form onSubmit={handleJoinMeeting} className="w-full sm:w-auto flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={meetingCodeInput}
                    onChange={(e) => setMeetingCodeInput(e.target.value)}
                    placeholder="Enter code or link"
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-dark-card border border-dark-border text-white text-sm placeholder:text-dark-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!meetingCodeInput.trim()}
                  className={`px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 ${
                    meetingCodeInput.trim()
                      ? 'bg-dark-card hover:bg-dark-panel border border-primary-500/40 text-primary-300 hover:text-white shadow-sm'
                      : 'bg-dark-card/50 border border-dark-border/40 text-dark-muted cursor-not-allowed'
                  }`}
                >
                  Join
                </button>
              </form>
            </div>

            {/* Trust and Feature Bullets */}
            <div className="pt-4 border-t border-dark-border/70 grid grid-cols-3 gap-4 text-left">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-accent-emerald shrink-0" />
                <span>WebRTC Security</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Zap className="w-4 h-4 text-primary-400 shrink-0" />
                <span>Sub-150ms Latency</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Laptop className="w-4 h-4 text-accent-cyan shrink-0" />
                <span>Zero Installs</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Schedule & Room Preview Card */}
          <div className="lg:col-span-5">
            <div className="glass-panel rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              {/* Header Tabs */}
              <div className="flex items-center justify-between border-b border-dark-border pb-4 mb-5">
                <div className="flex gap-4 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`pb-1 border-b-2 transition-all ${
                      activeTab === 'upcoming'
                        ? 'border-primary-500 text-white'
                        : 'border-transparent text-dark-muted hover:text-slate-300'
                    }`}
                  >
                    Upcoming Calls
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`pb-1 border-b-2 transition-all ${
                      activeTab === 'preview'
                        ? 'border-primary-500 text-white'
                        : 'border-transparent text-dark-muted hover:text-slate-300'
                    }`}
                  >
                    Interface Preview
                  </button>
                </div>
                <span className="text-[11px] text-dark-muted flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" /> Today
                </span>
              </div>

              {/* Tab 1: Upcoming Meetings Sample Content */}
              {activeTab === 'upcoming' ? (
                <div className="space-y-3.5">
                  <div className="p-4 rounded-2xl bg-dark-panel/90 border border-dark-border hover:border-primary-500/40 transition-all group">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full">
                          Ready to join
                        </span>
                        <h4 className="text-sm font-bold text-white mt-2 group-hover:text-primary-300 transition-colors">
                          Sprint Architecture & WebRTC Demo
                        </h4>
                        <p className="text-xs text-dark-muted mt-0.5">Code: <span className="font-mono text-slate-300">nex-demo-room</span></p>
                      </div>
                      <button
                        onClick={() => navigate('/room/nex-demo-room')}
                        className="px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-glow-primary transition-all flex items-center gap-1"
                      >
                        Enter
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-dark-border/50 flex items-center justify-between text-xs text-dark-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        3 participants scheduled
                      </span>
                      <span>11:30 AM - 12:00 PM</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-dark-panel/60 border border-dark-border/70 hover:border-dark-border transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-full">
                          Later today
                        </span>
                        <h4 className="text-sm font-bold text-white mt-2">
                          Client UI/UX Experience Review
                        </h4>
                        <p className="text-xs text-dark-muted mt-0.5">Code: <span className="font-mono text-slate-300">nex-design-sync</span></p>
                      </div>
                      <button
                        onClick={() => navigate('/room/nex-design-sync')}
                        className="px-3.5 py-1.5 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-slate-300 hover:text-white text-xs font-semibold transition-all"
                      >
                        Join Room
                      </button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-dark-border/50 flex items-center justify-between text-xs text-dark-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        2 participants scheduled
                      </span>
                      <span>3:00 PM - 3:45 PM</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Tab 2: Interface Preview Summary */
                <div className="space-y-4">
                  <div className="aspect-video rounded-2xl bg-dark-card border border-dark-border p-3 flex flex-col justify-between relative overflow-hidden group">
                    <div className="grid grid-cols-2 gap-2 h-full">
                      <div className="bg-dark-panel rounded-xl flex items-center justify-center border border-white/5 relative">
                        <span className="text-xs font-semibold text-slate-300">Pushpendra (You)</span>
                        <span className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-dark-bg/80 text-emerald-400">Mic On</span>
                      </div>
                      <div className="bg-dark-panel rounded-xl flex items-center justify-center border border-white/5 relative">
                        <span className="text-xs font-semibold text-slate-300">Sarah Chen</span>
                        <span className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-dark-bg/80 text-slate-400">Muted</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-dark-muted text-center leading-relaxed">
                    Interactive participant grid with adaptive layout algorithms and meeting controls.
                  </p>

                  <button
                    onClick={() => navigate('/room/nex-preview')}
                    className="w-full py-2.5 rounded-xl bg-dark-panel hover:bg-dark-hover border border-dark-border text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                  >
                    Open Live Room Layout Preview
                    <ArrowRight className="w-3.5 h-3.5 text-primary-400" />
                  </button>
                </div>
              )}

              {/* Informative Footer Badge */}
              <div className="mt-5 pt-4 border-t border-dark-border/80 flex items-center justify-between text-[11px] text-dark-muted">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Phase 1 UI Active
                </span>
                <span>P2P Mesh Signaling (Phases 3-5)</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-dark-border/60 py-4 px-6 text-center text-xs text-dark-muted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NexusMeet &copy; 2026. Production-style video conferencing application.</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Phase 1: Project Setup & Design System</span>
            <span className="hidden sm:inline">•</span>
            <span>Tailwind CSS & Express Architecture</span>
          </div>
        </div>
      </footer>

      {/* New Meeting Modal */}
      <NewMeetingModal
        isOpen={isNewMeetingModalOpen}
        onClose={() => setIsNewMeetingModalOpen(false)}
        meetingCode={generatedCode}
      />
    </div>
  );
};

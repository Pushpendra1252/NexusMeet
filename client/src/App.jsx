import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/common/Toast';
import { Navbar } from './components/common/Navbar';
import { SettingsModal } from './components/common/SettingsModal';
import { HomePage } from './pages/HomePage';
import { RoomPreviewPage } from './pages/RoomPreviewPage';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col font-sans">
        <Routes>
          {/* Main Dashboard / Landing View */}
          <Route
            path="/"
            element={
              <>
                <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
                <HomePage />
              </>
            }
          />

          {/* Interactive Room Preview View */}
          <Route path="/room/:roomId" element={<RoomPreviewPage />} />

          {/* Fallback to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </ToastProvider>
  );
}

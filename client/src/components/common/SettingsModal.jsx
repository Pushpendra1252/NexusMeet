import React, { useState } from 'react';
import { X, Mic, MicOff, Video, VideoOff, Volume2, Shield, Sliders, Check, AlertCircle } from 'lucide-react';
import { useToast } from '../common/Toast';

export const SettingsModal = ({
  isOpen,
  onClose,
  devices = { audioInputs: [], videoInputs: [], audioOutputs: [] },
  selectedAudioId = '',
  selectedVideoId = '',
  onSelectAudioDevice = () => {},
  onSelectVideoDevice = () => {},
  isMicOn = false,
  isVideoOn = false,
  audioLevel = 0,
  toggleCamera = () => {},
  toggleMicrophone = () => {},
}) => {
  const [activeTab, setActiveTab] = useState('audio');
  const [localDevices, setLocalDevices] = useState({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  const { addToast } = useToast();

  React.useEffect(() => {
    if (devices.audioInputs.length === 0 && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((list) => {
        const audioInputs = list.filter((d) => d.kind === 'audioinput');
        const videoInputs = list.filter((d) => d.kind === 'videoinput');
        const audioOutputs = list.filter((d) => d.kind === 'audiooutput');
        setLocalDevices({ audioInputs, videoInputs, audioOutputs });
      }).catch(() => {});
    }
  }, [devices]);

  const activeDevices = devices.audioInputs.length > 0 ? devices : localDevices;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-primary-400" />
            <h3 className="text-base font-bold text-white">Audio & Video Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-panel transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-dark-border px-6 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('audio')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'audio'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-dark-muted hover:text-slate-300'
            }`}
          >
            <Mic className="w-4 h-4" />
            Audio
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'video'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-dark-muted hover:text-slate-300'
            }`}
          >
            <Video className="w-4 h-4" />
            Video
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-dark-muted hover:text-slate-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            Diagnostics & System
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5">
          {activeTab === 'audio' && (
            <div className="space-y-4">
              {/* Microphone Device Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Microphone Input Device
                </label>
                <select
                  value={selectedAudioId}
                  onChange={(e) => onSelectAudioDevice(e.target.value)}
                  disabled={activeDevices.audioInputs.length === 0}
                  className="w-full bg-dark-panel border border-dark-border text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary-500 disabled:opacity-50"
                >
                  {activeDevices.audioInputs.length > 0 ? (
                    activeDevices.audioInputs.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="">No microphone granted or detected</option>
                  )}
                </select>
                {activeDevices.audioInputs.length === 0 && (
                  <p className="text-[11px] text-dark-muted mt-1.5">
                    Hardware names become available once microphone permission is granted.
                  </p>
                )}
              </div>

              {/* Speakers Device Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Speakers / Audio Output
                </label>
                <select
                  disabled={activeDevices.audioOutputs.length === 0}
                  className="w-full bg-dark-panel border border-dark-border text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary-500 disabled:opacity-50"
                >
                  {activeDevices.audioOutputs.length > 0 ? (
                    activeDevices.audioOutputs.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Speaker ${index + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="">Default System Output</option>
                  )}
                </select>
              </div>

              {/* Real-time Audio Level Meter */}
              <div className="p-4 rounded-xl bg-dark-panel border border-dark-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="w-4 h-4 text-primary-400" />
                    <span className="text-xs font-medium text-slate-200">Real-Time Audio Input Meter</span>
                  </div>
                  {isMicOn ? (
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Live Input: {audioLevel}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-dark-muted bg-dark-card px-2 py-0.5 rounded-full border border-dark-border">
                      Muted / Inactive
                    </span>
                  )}
                </div>

                {/* Animated Level Bar */}
                <div className="w-full h-3 bg-dark-card rounded-full overflow-hidden border border-dark-border/80 relative">
                  <div
                    className={`h-full transition-all duration-75 rounded-full ${
                      audioLevel > 60
                        ? 'bg-accent-emerald'
                        : audioLevel > 25
                        ? 'bg-primary-500'
                        : 'bg-indigo-600'
                    }`}
                    style={{ width: `${isMicOn ? audioLevel : 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-dark-muted">
                    {isMicOn
                      ? 'Speak into your microphone to verify live volume levels.'
                      : 'Enable microphone to measure and calibrate live audio.'}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await toggleMicrophone();
                      if (res && res.error) {
                        addToast(res.error, 'danger');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                      isMicOn
                        ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                        : 'bg-primary-600 hover:bg-primary-500 text-white shadow-glow-primary'
                    }`}
                  >
                    {isMicOn ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" /> Mute Mic
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" /> Enable Mic
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-4">
              {/* Camera Device Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Camera Input Device
                </label>
                <select
                  value={selectedVideoId}
                  onChange={(e) => onSelectVideoDevice(e.target.value)}
                  disabled={activeDevices.videoInputs.length === 0}
                  className="w-full bg-dark-panel border border-dark-border text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary-500 disabled:opacity-50"
                >
                  {activeDevices.videoInputs.length > 0 ? (
                    activeDevices.videoInputs.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="">No camera granted or detected</option>
                  )}
                </select>
                {activeDevices.videoInputs.length === 0 && (
                  <p className="text-[11px] text-dark-muted mt-1.5">
                    Hardware names become available once camera permission is granted.
                  </p>
                )}
              </div>

              {/* Camera Status Card */}
              <div className="p-4 rounded-xl bg-dark-panel border border-dark-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary-400" />
                    <span className="text-xs font-medium text-slate-200">Webcam Hardware Status</span>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      isVideoOn
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-dark-muted bg-dark-card border-dark-border'
                    }`}
                  >
                    {isVideoOn ? 'Camera Active' : 'Camera Off'}
                  </span>
                </div>

                <p className="text-xs text-dark-muted leading-relaxed">
                  {isVideoOn
                    ? 'Your camera is streaming live in the room tile. Changes apply immediately without reloading.'
                    : 'Your video feed is turned off. Toggle camera below to preview local stream.'}
                </p>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await toggleCamera();
                      if (res && res.error) {
                        addToast(res.error, 'danger');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      isVideoOn
                        ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                        : 'bg-primary-600 hover:bg-primary-500 text-white shadow-glow-primary'
                    }`}
                  >
                    {isVideoOn ? (
                      <>
                        <VideoOff className="w-3.5 h-3.5" /> Turn Off Camera
                      </>
                    ) : (
                      <>
                        <Video className="w-3.5 h-3.5" /> Turn On Camera
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-dark-panel border border-dark-border text-xs space-y-1.5">
                <div className="font-semibold text-white">Media Permissions & Hardware</div>
                <div className="text-dark-muted">
                  Devices: {devices.audioInputs.length} audio input(s), {devices.videoInputs.length} video input(s).
                </div>
                <div className="text-dark-muted">Audio Processing: Echo Cancellation & Noise Suppression enabled.</div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Web Audio API active for live decibel and frequency analysis.</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-dark-border bg-dark-bg/40">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-500 text-white shadow-glow-primary transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

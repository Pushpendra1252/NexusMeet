import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MonitorUp, 
  MessageSquare, 
  Users, 
  PhoneOff, 
  Copy, 
  Check, 
  Settings, 
  Send,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Loader2,
  Clock,
  Radio,
  Wifi,
  WifiOff,
  ShieldAlert,
  Volume2
} from 'lucide-react';
import { useToast } from '../components/common/Toast';
import { SettingsModal } from '../components/common/SettingsModal';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useRoomChat } from '../hooks/useRoomChat';

/**
 * Dedicated Remote Participant Video Tile for Mesh WebRTC.
 * Manages its own video element ref, playback lifecycle, media state overlay, and initials badge.
 */
const RemoteVideoTile = ({
  participant,
  stream,
  mediaState,
  connectionState,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn(`[WebRTC] Autoplay restriction for ${participant.displayName}:`, err);
        });
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  const isVideoLive = Boolean(
    (mediaState?.isVideoOn || mediaState?.isScreenSharing) && stream
  );
  const isPeerConnected = connectionState === 'connected';

  const handlePlayRetry = () => {
    if (videoRef.current && videoRef.current.paused && stream) {
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div 
      onClick={handlePlayRetry}
      className="w-full h-full min-h-[220px] rounded-3xl bg-dark-card border border-dark-border relative overflow-hidden flex flex-col justify-between p-4 sm:p-5 shadow-2xl transition-all"
    >
      {/* Real Remote Video Element (Unmuted so remote audio plays to speakers) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
          isVideoLive
            ? mediaState?.isScreenSharing
              ? 'object-contain bg-slate-950 opacity-100'
              : 'object-cover opacity-100'
            : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Remote Avatar Placeholder (shown when neither camera nor screen share is active) */}
      {!isVideoLive && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-dark-panel to-slate-900 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-20 h-20 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-300 text-2xl font-bold mb-2 shadow-inner">
            {(participant.displayName || 'G').slice(0, 2).toUpperCase()}
          </div>
          <h4 className="text-sm font-bold text-white mb-1">
            {participant.displayName}
          </h4>
          {isPeerConnected ? (
            <span className="text-[10px] text-slate-300 bg-dark-card/90 px-2.5 py-0.5 rounded-full border border-dark-border flex items-center gap-1.5 font-medium mb-1">
              Camera is turned off
            </span>
          ) : (
            <span className="text-[10px] text-accent-amber bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1.5 font-medium mb-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Connecting P2P...
            </span>
          )}
          <p className="text-[10px] text-dark-muted max-w-xs mt-0.5">
            {mediaState?.isMicOn ? 'Microphone is unmuted' : 'Microphone is muted'}
          </p>
        </div>
      )}

      {/* Top Overlay Badge */}
      <div className="relative z-10 flex justify-between items-start w-full pointer-events-none">
        <span className="text-xs font-semibold text-white/95 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 shadow-sm flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isPeerConnected ? 'bg-accent-emerald' : 'bg-accent-amber animate-pulse'
            }`}
          />
          {participant.displayName}
        </span>

        {mediaState?.isScreenSharing ? (
          <span className="text-[10px] font-bold text-primary-300 bg-primary-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-primary-500/40 flex items-center gap-1 shadow-sm">
            <MonitorUp className="w-3 h-3 text-primary-400 animate-pulse" />
            Screen Share
          </span>
        ) : isPeerConnected && mediaState?.isVideoOn ? (
          <span className="text-[10px] font-bold text-emerald-300 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
            Live P2P
          </span>
        ) : null}
      </div>

      {/* Bottom Overlay Badge (Remote Microphone Status) */}
      <div className="relative z-10 flex justify-end items-center w-full pointer-events-none">
        <div
          className={`p-2 rounded-xl backdrop-blur-md transition-all shadow-sm ${
            mediaState?.isMicOn
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/25 text-rose-400'
          }`}
          title={
            mediaState?.isMicOn
              ? `${participant.displayName}'s microphone is live`
              : `${participant.displayName}'s microphone is muted`
          }
        >
          {mediaState?.isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
};

export const RoomPreviewPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Stable local display name generated once per session tab
  const localDisplayName = useMemo(() => {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `Guest ${randomSuffix}`;
  }, []);

  // Real-time Socket.IO room membership hook
  const {
    socket,
    connectionStatus,
    participants: roomParticipants,
    participantCount,
    socketError,
    selfInfo,
    isOverCapacity,
    initialMessages,
    leaveRoom,
  } = useRoomSocket(roomId, localDisplayName);

  // Real local media hardware hook
  const {
    localStream,
    isMicOn,
    isVideoOn,
    isLoadingMedia,
    cameraError,
    micError,
    devices,
    selectedAudioId,
    selectedVideoId,
    audioLevel,
    toggleCamera,
    toggleMicrophone,
    switchCameraDevice,
    switchAudioDevice,
    stopAllTracks,
  } = useMediaDevices();

  // Identify remote participants for Mesh WebRTC (all non-local participants)
  const remoteParticipants = useMemo(() => {
    return roomParticipants.filter((p) => !p.isLocal);
  }, [roomParticipants]);

  // Real-time Multi-Participant Mesh WebRTC calling hook with Screen Sharing
  const {
    remoteStreams,
    remoteMediaStates,
    peerConnectionStates,
    connectedPeerCount,
    isCallActive,
    callError,
    isScreenSharing,
    screenStream,
    screenError,
    startScreenShare,
    stopScreenShare,
  } = useWebRTC({
    socket,
    selfSocketId: selfInfo?.socketId,
    remoteParticipants,
    localStream,
    isMicOn,
    isVideoOn,
  });

  // Local DOM video element
  const localVideoRef = useRef(null);

  // UI state
  const [copied, setCopied] = useState(false);
  const [activeSideDrawer, setActiveSideDrawer] = useState(null); // 'chat' | 'participants' | null
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  // In-meeting Chat hook (real-time Socket.IO messages)
  const {
    messages: chatMessages,
    unreadCount,
    isSending: isSendingChat,
    sendError: chatSendError,
    sendMessage: sendChatMessage,
    clearError: clearChatError,
  } = useRoomChat({
    socket,
    roomId,
    selfSocketId: selfInfo?.socketId,
    isDrawerOpen: activeSideDrawer === 'chat',
    initialMessages,
  });

  const [newChatMessage, setNewChatMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll chat to latest message when drawer is open
  useEffect(() => {
    if (activeSideDrawer === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeSideDrawer]);

  // Format timestamp helper
  const formatMessageTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Synchronize local video stream (screen share or camera) to local <video> DOM element
  useEffect(() => {
    if (localVideoRef.current) {
      if (isScreenSharing && screenStream) {
        localVideoRef.current.srcObject = screenStream;
      } else if (localStream && isVideoOn) {
        localVideoRef.current.srcObject = localStream;
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [isScreenSharing, screenStream, localStream, isVideoOn]);

  // Handle screen sharing error toasts
  useEffect(() => {
    if (screenError) {
      addToast(screenError, 'danger', 5000);
    }
  }, [screenError, addToast]);

  // Handle hardware errors with toasts
  useEffect(() => {
    if (cameraError) {
      addToast(cameraError, 'danger', 5000);
    }
  }, [cameraError, addToast]);

  useEffect(() => {
    if (micError) {
      addToast(micError, 'danger', 5000);
    }
  }, [micError, addToast]);

  useEffect(() => {
    if (callError) {
      addToast(callError, 'danger', 6000);
    }
  }, [callError, addToast]);

  const handleCopyMeetingLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    setCopied(true);
    addToast('Meeting link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCameraToggle = async () => {
    const res = await toggleCamera();
    if (res?.success) {
      addToast(
        res.enabled
          ? 'Camera enabled (transmitting video to peers)'
          : 'Camera stopped and released',
        'info'
      );
    }
  };

  const handleMicToggle = async () => {
    const res = await toggleMicrophone();
    if (res?.success) {
      addToast(res.enabled ? 'Microphone unmuted (audio live)' : 'Microphone muted', 'info');
    }
  };

  const handleScreenShareToggle = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      addToast('Screen sharing stopped', 'info');
    } else {
      const res = await startScreenShare();
      if (res?.success) {
        addToast('Screen sharing active (broadcasting to peers)', 'success');
      } else if (res?.error) {
        addToast(res.error, 'danger');
      }
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newChatMessage.trim() || isSendingChat) return;

    const textToSend = newChatMessage;
    setNewChatMessage('');
    const success = await sendChatMessage(textToSend);
    if (!success) {
      setNewChatMessage(textToSend); // Restore draft if sending failed
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfirmLeave = () => {
    if (isScreenSharing) {
      stopScreenShare();
    }
    leaveRoom();
    stopAllTracks();
    navigate('/');
  };

  // Stop hardware tracks on tab close or refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isScreenSharing) {
        stopScreenShare();
      }
      stopAllTracks();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isScreenSharing, stopScreenShare, stopAllTracks]);

  // Total participants displayed in grid: local + remotes
  const totalGridParticipants = 1 + remoteParticipants.length;

  return (
    <div className="relative h-screen w-screen bg-dark-bg flex flex-col overflow-hidden select-none">
      
      {/* Top Bar */}
      <header className="h-14 border-b border-dark-border/80 bg-dark-card/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          {/* Room ID Badge & Copy Link */}
          <div className="flex items-center gap-2 bg-dark-panel border border-dark-border px-3 py-1.5 rounded-xl">
            <span className="text-xs font-mono font-semibold text-slate-200">{roomId}</span>
            <button
              onClick={handleCopyMeetingLink}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-dark-card transition-colors"
              title="Copy meeting link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Real-time Socket Connection Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-dark-panel border-dark-border">
            {connectionStatus === 'connected' ? (
              <span className="flex items-center gap-1.5 text-accent-emerald">
                <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                <span className="hidden sm:inline">Signaling</span> Connected
              </span>
            ) : connectionStatus === 'connecting' ? (
              <span className="flex items-center gap-1.5 text-accent-amber">
                <Loader2 className="w-3 h-3 text-accent-amber animate-spin" />
                Connecting...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-accent-rose">
                <span className="w-2 h-2 rounded-full bg-accent-rose" />
                Disconnected
              </span>
            )}
          </div>

          {/* Mesh WebRTC Call Status Pill */}
          {remoteParticipants.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-dark-panel border-dark-border">
              {connectedPeerCount > 0 ? (
                <span className="flex items-center gap-1.5 text-accent-emerald">
                  <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                  Mesh Live ({connectedPeerCount}/{remoteParticipants.length})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-primary-300">
                  <Loader2 className="w-3 h-3 animate-spin text-primary-400" />
                  Negotiating Mesh...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Info Controls */}
        <div className="flex items-center gap-2">
          {/* Real Server Participant Count */}
          <div className="flex items-center gap-1.5 text-xs text-slate-200 font-medium px-2.5 py-1 rounded-lg bg-dark-panel border border-dark-border">
            <Users className="w-3.5 h-3.5 text-primary-400" />
            <span>{participantCount} / 4 in meeting</span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-panel transition-colors"
            title="Audio & Video Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Capacity Warning Banner (For full 4 participants) */}
      {isOverCapacity && (
        <div className="bg-amber-950/80 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 z-20">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <ShieldAlert className="w-4 h-4 text-accent-amber shrink-0" />
            <span>
              <strong>Room Capacity Notice:</strong> NexusMeet room is at maximum capacity (4 participants).
            </span>
          </div>
        </div>
      )}

      {/* Main Video & Participant Canvas Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 p-3 sm:p-6 flex flex-col items-center justify-center gap-4 overflow-auto">
          
          {/* Dynamic Responsive Video Grid: 1, 2, 3, or 4 participants */}
          <div
            className={`w-full h-full max-h-[640px] items-center justify-center ${
              totalGridParticipants <= 1
                ? 'max-w-4xl flex flex-col'
                : totalGridParticipants === 2
                  ? 'max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-4'
                  : totalGridParticipants === 3
                    ? 'max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'max-w-6xl grid grid-cols-1 sm:grid-cols-2 gap-4'
            }`}
          >
            {/* Tile 1: LOCAL USER TILE */}
            <div className="w-full h-full min-h-[220px] rounded-3xl bg-dark-card border border-dark-border relative overflow-hidden flex flex-col justify-between p-4 sm:p-5 group shadow-2xl transition-all">
              
              {/* Real Local Video Element (Screen share or camera, unmirrored if sharing screen) */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
                  isScreenSharing
                    ? 'object-contain bg-slate-950 opacity-100'
                    : isVideoOn
                      ? 'object-cover -scale-x-100 opacity-100'
                      : 'opacity-0 pointer-events-none'
                }`}
              />

              {/* Local Avatar Placeholder (displayed when neither camera nor screen share is active) */}
              {!isVideoOn && !isScreenSharing && (
                <div className="absolute inset-0 bg-dark-panel flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-dark-card border border-dark-border flex items-center justify-center text-slate-300 text-xl font-bold mb-3 shadow-inner">
                    You
                  </div>

                  {isLoadingMedia ? (
                    <div className="flex items-center gap-2 text-xs text-primary-300">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Accessing camera hardware...</span>
                    </div>
                  ) : cameraError ? (
                    <div className="flex flex-col items-center gap-2 max-w-sm">
                      <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="text-xs leading-tight">{cameraError}</span>
                      </div>
                      <button
                        onClick={handleCameraToggle}
                        className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-semibold underline mt-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Try again
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2.5">
                      <span className="text-xs text-dark-muted font-medium">Your camera is turned off</span>
                      <button
                        onClick={handleCameraToggle}
                        className="px-4 py-2 rounded-xl bg-primary-600/30 hover:bg-primary-600/50 border border-primary-500/30 text-primary-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
                      >
                        <Video className="w-3.5 h-3.5" /> Turn on camera
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Top Bar Overlay on Local Tile */}
              <div className="relative z-10 flex justify-between items-start w-full pointer-events-none">
                <span className="text-xs font-semibold text-white/95 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent-emerald" />
                  You ({selfInfo?.displayName || localDisplayName})
                </span>

                {isScreenSharing ? (
                  <span className="text-[10px] font-bold text-primary-300 bg-primary-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-primary-500/40 flex items-center gap-1.5 shadow-sm">
                    <MonitorUp className="w-3 h-3 text-primary-400 animate-pulse" />
                    Sharing Your Screen
                  </span>
                ) : isVideoOn ? (
                  <span className="text-[10px] font-bold text-emerald-300 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    Local Feed
                  </span>
                ) : null}
              </div>

              {/* Bottom Status Overlay */}
              <div className="relative z-10 flex justify-end items-center w-full pointer-events-none">
                <div
                  className={`p-2.5 rounded-2xl backdrop-blur-md transition-all shadow-sm ${
                    isMicOn
                      ? audioLevel > 15
                        ? 'bg-emerald-500/40 text-emerald-300 ring-2 ring-emerald-400/50 scale-105'
                        : 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/25 text-rose-400'
                  }`}
                  title={isMicOn ? `Your microphone is transmitting (${audioLevel}%)` : 'Your microphone is muted'}
                >
                  {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {/* Tiles 2..N: REMOTE PARTICIPANTS MESH TILES */}
            {remoteParticipants.map((p) => (
              <RemoteVideoTile
                key={p.socketId}
                participant={p}
                stream={remoteStreams[p.socketId]}
                mediaState={remoteMediaStates[p.socketId]}
                connectionState={peerConnectionStates[p.socketId]}
              />
            ))}
          </div>

          {/* Dynamic Footer Banner: Waiting vs Call Connected Status */}
          <div className="w-full max-w-4xl p-3.5 sm:p-4 rounded-2xl bg-dark-card/90 border border-dark-border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 shrink-0">
                {remoteParticipants.length === 0 ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <Users className="w-5 h-5 text-accent-emerald" />
                )}
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">
                  {remoteParticipants.length === 0
                    ? 'Waiting for others to join'
                    : `Mesh Meeting: ${participantCount}/4 participants (${connectedPeerCount} active P2P)`}
                </h4>
                <p className="text-[11px] text-dark-muted">
                  {remoteParticipants.length === 0
                    ? `Share meeting code ${roomId} with others to invite up to 4 participants.`
                    : 'Encrypted peer-to-peer mesh WebRTC audio, video, and screen sharing.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleCopyMeetingLink}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-dark-panel hover:bg-dark-hover border border-dark-border text-slate-200 hover:text-white transition-all shrink-0 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied' : 'Copy Meeting Link'}</span>
            </button>
          </div>

        </main>

        {/* Collapsible Right Sidebar (Chat / Participants) */}
        {activeSideDrawer && (
          <aside className="w-80 md:w-96 border-l border-dark-border bg-dark-card flex flex-col shrink-0 z-20 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {activeSideDrawer === 'chat' ? (
                  <>
                    <MessageSquare className="w-4 h-4 text-primary-400" />
                    In-Call Messages
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 text-primary-400" />
                    Participants ({participantCount}/4)
                  </>
                )}
              </h3>
              <button
                onClick={() => setActiveSideDrawer(null)}
                className="text-xs text-dark-muted hover:text-white px-2 py-1 rounded-lg hover:bg-dark-panel transition-colors"
              >
                Close
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeSideDrawer === 'chat' ? (
                <>
                  <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-[11px] text-primary-300 leading-relaxed">
                    Messages are seen only by participants in this meeting room.
                  </div>

                  {chatMessages.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-dark-muted space-y-2">
                      <div className="w-10 h-10 rounded-full bg-dark-panel flex items-center justify-center text-slate-500">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-medium text-slate-300">No messages yet</p>
                      <p className="text-[11px] max-w-[200px]">Send a message below to start the conversation.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatMessages.map((msg) => {
                        const isSelf = msg.senderSocketId === selfInfo?.socketId;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-dark-muted px-1">
                              <span className={isSelf ? 'font-semibold text-primary-300' : 'font-semibold text-white'}>
                                {isSelf ? 'You' : msg.senderName || 'Participant'}
                              </span>
                              <span>•</span>
                              <span>{formatMessageTime(msg.timestamp)}</span>
                            </div>
                            <div
                              className={`p-3 rounded-2xl ${
                                isSelf
                                  ? 'rounded-tr-sm bg-primary-600/25 border border-primary-500/40 text-slate-100'
                                  : 'rounded-tl-sm bg-dark-panel border border-dark-border/80 text-slate-200'
                              } max-w-[90%] shadow-sm`}
                            >
                              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </>
              ) : (
                /* Participants List populated with REAL server socket participants */
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-dark-muted px-1">
                    In Meeting ({participantCount} of 4)
                  </div>
                  
                  {roomParticipants.map((p) => {
                    const isLocal = p.isLocal;
                    const pMedia = isLocal
                      ? { isVideoOn: isScreenSharing ? true : isVideoOn, isMicOn, isScreenSharing }
                      : (remoteMediaStates[p.socketId] || {});
                    const peerVideo = pMedia.isVideoOn;
                    const peerMic = pMedia.isMicOn;
                    const peerScreen = pMedia.isScreenSharing;

                    return (
                      <div key={p.socketId} className="p-3 rounded-xl bg-dark-panel border border-dark-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-600/30 border border-primary-500/40 flex items-center justify-center text-xs font-bold text-primary-300">
                            {(p.displayName || 'G').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                              {p.displayName} {isLocal && '(You)'}
                            </div>
                            <div className="text-[10px] text-dark-muted">
                              {isLocal ? 'Local Participant' : 'Remote Peer (Mesh WebRTC)'}
                            </div>
                          </div>
                        </div>

                        {/* Hardware status icons for both local and remote users */}
                        <div className="flex items-center gap-1.5 text-slate-400">
                          {peerScreen && (
                            <span className="p-1 rounded bg-primary-500/10 text-primary-400" title="Sharing screen">
                              <MonitorUp className="w-3.5 h-3.5 animate-pulse" />
                            </span>
                          )}
                          {peerMic ? (
                            <span className="p-1 rounded bg-emerald-500/10 text-accent-emerald" title="Microphone unmuted">
                              <Mic className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="p-1 rounded bg-rose-500/10 text-accent-rose" title="Microphone muted">
                              <MicOff className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {peerVideo ? (
                            <span className="p-1 rounded bg-emerald-500/10 text-accent-emerald" title="Camera active">
                              <Video className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="p-1 rounded bg-rose-500/10 text-accent-rose" title="Camera off">
                              <VideoOff className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty state invitation section if alone */}
                  {remoteParticipants.length === 0 && (
                    <div className="p-4 rounded-xl border border-dashed border-dark-border text-center space-y-2 mt-4 bg-dark-bg/40">
                      <Users className="w-5 h-5 text-dark-muted mx-auto" />
                      <div className="text-xs font-semibold text-slate-300">Waiting for others to join</div>
                      <p className="text-[11px] text-dark-muted leading-relaxed">
                        Anyone with the meeting link can enter this room (up to 4 participants).
                      </p>
                      <button
                        onClick={handleCopyMeetingLink}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-panel hover:bg-dark-hover border border-dark-border text-slate-200 transition-colors inline-block mt-1"
                      >
                        Copy link to invite
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            {activeSideDrawer === 'chat' && (
              <form onSubmit={handleSendMessage} className="p-3 border-t border-dark-border space-y-2">
                {chatSendError && (
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-accent-rose text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{chatSendError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearChatError}
                      className="text-slate-400 hover:text-white text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Type a message (Enter to send, Shift+Enter for newline)..."
                    maxLength={1000}
                    className="flex-1 bg-dark-panel border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder:text-dark-muted focus:outline-none focus:border-primary-500 resize-none max-h-28"
                  />
                  <button
                    type="submit"
                    disabled={!newChatMessage.trim() || isSendingChat}
                    className="p-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white transition-all shadow-glow-primary shrink-0"
                    title="Send message"
                  >
                    {isSendingChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {newChatMessage.length > 800 && (
                  <div className="text-[10px] text-right text-dark-muted">
                    {newChatMessage.length} / 1000
                  </div>
                )}
              </form>
            )}
          </aside>
        )}
      </div>

      {/* Floating Bottom Controls Bar */}
      <footer className="h-20 bg-dark-card/95 border-t border-dark-border px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        
        {/* Left Info: Meeting Code & Count */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 font-medium">
          <span>Meeting: <span className="font-mono text-primary-400 font-semibold">{roomId}</span></span>
          <span className="text-dark-muted">•</span>
          <span className="text-dark-muted">{participantCount}/4 in room</span>
          {isCallActive && (
            <span className="text-accent-emerald font-semibold ml-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" /> Mesh Call ({connectedPeerCount} active)
            </span>
          )}
        </div>

        {/* Center: Essential Controls */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto sm:mx-0">
          
          {/* Microphone Toggle (Real hardware toggle, live updates WebRTC audio track) */}
          <button
            onClick={handleMicToggle}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isMicOn
                ? 'bg-dark-panel hover:bg-dark-hover text-white border border-dark-border'
                : 'bg-accent-rose hover:bg-rose-600 text-white shadow-glow-danger'
            }`}
            title={isMicOn ? 'Mute microphone' : 'Unmute microphone (request access)'}
          >
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Camera Toggle (Full lifecycle toggle: stops track & releases hardware; paused during screen share) */}
          <button
            onClick={handleCameraToggle}
            disabled={isScreenSharing}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-dark-panel text-slate-500 border border-dark-border/50 cursor-not-allowed opacity-60'
                : isVideoOn
                  ? 'bg-dark-panel hover:bg-dark-hover text-white border border-dark-border'
                  : 'bg-accent-rose hover:bg-rose-600 text-white shadow-glow-danger'
            }`}
            title={
              isScreenSharing
                ? 'Camera is paused while sharing your screen'
                : isVideoOn
                  ? 'Turn off camera (releases hardware)'
                  : 'Turn on camera (reacquires stream & sends to peers)'
            }
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share Toggle (Uses getDisplayMedia and replaces video track over WebRTC) */}
          <button
            onClick={handleScreenShareToggle}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-glow-primary ring-2 ring-primary-400/50'
                : 'bg-dark-panel hover:bg-dark-hover text-white border border-dark-border'
            }`}
            title={isScreenSharing ? 'Stop sharing your screen' : 'Share your screen'}
          >
            <MonitorUp className="w-5 h-5" />
          </button>

          {/* End Call / Leave Meeting Button (Red) */}
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="px-5 h-12 rounded-2xl bg-accent-rose hover:bg-rose-600 text-white font-semibold text-sm flex items-center gap-2 shadow-glow-danger transition-all ml-2"
            title="Leave Meeting"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden md:inline">Leave</span>
          </button>
        </div>

        {/* Right: Panel Toggles */}
        <div className="flex items-center gap-2">
          {/* Chat Toggle */}
          <button
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'chat' ? null : 'chat')}
            className={`p-3 rounded-2xl border transition-all relative ${
              activeSideDrawer === 'chat'
                ? 'bg-primary-600 text-white border-primary-500 shadow-glow-primary'
                : 'bg-dark-panel text-slate-300 hover:text-white border-dark-border hover:bg-dark-hover'
            }`}
            title="Toggle In-Call Chat"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && activeSideDrawer !== 'chat' && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-md">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => setActiveSideDrawer(activeSideDrawer === 'participants' ? null : 'participants')}
            className={`p-3 rounded-2xl border transition-all relative ${
              activeSideDrawer === 'participants'
                ? 'bg-primary-600 text-white border-primary-500 shadow-glow-primary'
                : 'bg-dark-panel text-slate-300 hover:text-white border-dark-border hover:bg-dark-hover'
            }`}
            title="Toggle Participants"
          >
            <Users className="w-5 h-5" />
            {participantCount > 1 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-emerald text-white text-[10px] font-bold flex items-center justify-center">
                {participantCount}
              </span>
            )}
          </button>
        </div>
      </footer>

      {/* Leave Meeting Confirmation Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-dark-card border border-dark-border rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-accent-rose mx-auto flex items-center justify-center">
              <PhoneOff className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Leave this meeting?</h3>
              <p className="text-xs text-dark-muted mt-1">
                Your WebRTC session will be disconnected and media devices released.
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-dark-panel hover:bg-dark-hover border border-dark-border transition-colors"
              >
                Stay
              </button>
              <button
                onClick={handleConfirmLeave}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-accent-rose hover:bg-rose-600 shadow-glow-danger transition-all"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error state if failed to connect or room rejection (e.g. room full) */}
      {connectionStatus === 'error' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/95 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-accent-rose mx-auto flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Unable to Join Meeting</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {socketError || 'Could not establish connection to the meeting room.'}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  stopAllTracks();
                  navigate('/');
                }}
                className="w-full py-3 px-5 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm shadow-glow-primary transition-all"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal with Real Hardware State */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        devices={devices}
        selectedAudioId={selectedAudioId}
        selectedVideoId={selectedVideoId}
        onSelectAudioDevice={switchAudioDevice}
        onSelectVideoDevice={switchCameraDevice}
        isMicOn={isMicOn}
        isVideoOn={isVideoOn}
        audioLevel={audioLevel}
        toggleCamera={toggleCamera}
        toggleMicrophone={toggleMicrophone}
      />
    </div>
  );
};

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RTC_CONFIG } from '../services/webrtcConfig';

/**
 * Custom hook to manage Multi-Participant Mesh WebRTC audio/video calling (up to 4 participants).
 * Implements a full mesh architecture where each participant maintains an independent
 * RTCPeerConnection with every other participant in the room.
 *
 * Features:
 * - W3C Perfect Negotiation with deterministic politeness (selfSocketId < remoteSocketId)
 * - Independent peer connection lifecycle per remote participant (joins/leaves don't disrupt others)
 * - ICE candidate buffering and graceful draining
 * - Kind-safe replaceTrack hot-swapping for camera, mic, and screen sharing
 * - Screen sharing broadcast across all active peers with browser-native stop handling
 * - Backward-compatible return signatures for 1-to-1 components
 */
export const useWebRTC = ({
  socket,
  selfSocketId,
  remoteParticipants = [],
  remoteParticipant = null, // backward compatibility
  localStream,
  isMicOn,
  isVideoOn,
}) => {
  // Normalize remote participants array
  const activeRemoteParticipants = useMemo(() => {
    if (Array.isArray(remoteParticipants) && remoteParticipants.length > 0) {
      return remoteParticipants;
    }
    if (remoteParticipant && remoteParticipant.socketId) {
      return [remoteParticipant];
    }
    return [];
  }, [remoteParticipants, remoteParticipant]);

  // Multi-peer reactive states keyed by remoteSocketId
  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteMediaStates, setRemoteMediaStates] = useState({});
  const [peerConnectionStates, setPeerConnectionStates] = useState({});
  const [callError, setCallError] = useState(null);

  // Screen sharing states
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [screenError, setScreenError] = useState(null);

  /**
   * Mesh peers map:
   * remoteSocketId -> {
   *   socketId,
   *   pc: RTCPeerConnection,
   *   remoteStream: MediaStream,
   *   videoSender: RTCRtpSender | null,
   *   audioSender: RTCRtpSender | null,
   *   candidateQueue: RTCIceCandidateInit[],
   *   makingOffer: boolean,
   *   ignoreOffer: boolean,
   *   isPolite: boolean,
   * }
   */
  const peersRef = useRef(new Map());
  const screenStreamRef = useRef(null);
  const wasCameraOnBeforeSharingRef = useRef(false);

  // Stable references to local media inputs to avoid churn in createPeerConnection and listener hooks
  const localStreamRef = useRef(localStream);
  const isVideoOnRef = useRef(isVideoOn);
  const isMicOnRef = useRef(isMicOn);
  const isScreenSharingRef = useRef(isScreenSharing);

  useEffect(() => {
    localStreamRef.current = localStream;
    isVideoOnRef.current = isVideoOn;
    isMicOnRef.current = isMicOn;
    isScreenSharingRef.current = isScreenSharing;
  }, [localStream, isVideoOn, isMicOn, isScreenSharing]);

  /**
   * Determine media kind ('audio' | 'video' | null) of an RTCRtpSender.
   * Standard RTCRtpSender does not have a `.kind` property, so we check
   * sender.track.kind first, and if null, check the corresponding
   * RTCRtpTransceiver's receiver track kind which is immutable.
   */
  const getSenderKind = useCallback((sender, pc) => {
    if (!sender) return null;
    if (sender.track?.kind) {
      return sender.track.kind;
    }
    if (pc && typeof pc.getTransceivers === 'function') {
      const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
      if (transceiver?.receiver?.track?.kind) {
        return transceiver.receiver.track.kind;
      }
    }
    return null;
  }, []);

  /**
   * Safely resolve the outgoing video RTCRtpSender from a specific peer connection.
   */
  const getVideoSender = useCallback((pc, peerEntry) => {
    if (!pc || pc.connectionState === 'closed') return null;

    const currentSenders = pc.getSenders();

    // 1. Check cached reference in peerEntry
    if (peerEntry?.videoSender && currentSenders.includes(peerEntry.videoSender)) {
      const kind = getSenderKind(peerEntry.videoSender, pc);
      if (kind === 'video') {
        return peerEntry.videoSender;
      }
    }

    // 2. Locate sender by active video track
    const senderWithVideoTrack = currentSenders.find((s) => s.track?.kind === 'video');
    if (senderWithVideoTrack) {
      if (peerEntry) peerEntry.videoSender = senderWithVideoTrack;
      return senderWithVideoTrack;
    }

    // 3. Locate sender by transceiver (receiver track kind is immutable: 'video')
    if (typeof pc.getTransceivers === 'function') {
      const videoTransceiver = pc.getTransceivers().find(
        (t) => t.receiver?.track?.kind === 'video' || t.sender?.track?.kind === 'video'
      );
      if (videoTransceiver?.sender) {
        if (peerEntry) peerEntry.videoSender = videoTransceiver.sender;
        return videoTransceiver.sender;
      }
    }

    console.warn(`[WebRTC] getVideoSender: No video sender found for ${peerEntry?.socketId || 'peer'}`);
    return null;
  }, [getSenderKind]);

  /**
   * Safely resolve the outgoing audio RTCRtpSender from a specific peer connection.
   */
  const getAudioSender = useCallback((pc, peerEntry) => {
    if (!pc || pc.connectionState === 'closed') return null;

    const currentSenders = pc.getSenders();

    // 1. Check cached reference in peerEntry
    if (peerEntry?.audioSender && currentSenders.includes(peerEntry.audioSender)) {
      const kind = getSenderKind(peerEntry.audioSender, pc);
      if (kind === 'audio') {
        return peerEntry.audioSender;
      }
    }

    // 2. Locate sender by active audio track
    const senderWithAudioTrack = currentSenders.find((s) => s.track?.kind === 'audio');
    if (senderWithAudioTrack) {
      if (peerEntry) peerEntry.audioSender = senderWithAudioTrack;
      return senderWithAudioTrack;
    }

    // 3. Locate sender by transceiver (receiver track kind is immutable: 'audio')
    if (typeof pc.getTransceivers === 'function') {
      const audioTransceiver = pc.getTransceivers().find(
        (t) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
      );
      if (audioTransceiver?.sender) {
        if (peerEntry) peerEntry.audioSender = audioTransceiver.sender;
        return audioTransceiver.sender;
      }
    }

    console.warn(`[WebRTC] getAudioSender: No audio sender found for ${peerEntry?.socketId || 'peer'}`);
    return null;
  }, [getSenderKind]);

  /**
   * Safe wrapper for replaceTrack to guarantee kind matching before execution.
   * Completely eliminates 'Track kind does not match Sender Kind' errors.
   */
  const safeReplaceTrack = useCallback(async (sender, track, expectedKind, pc, label = '') => {
    if (!sender) {
      console.warn(`[WebRTC] safeReplaceTrack (${label}): Sender is null or undefined.`);
      return false;
    }

    const senderKind = getSenderKind(sender, pc);
    if (senderKind !== expectedKind) {
      console.error(
        `[WebRTC] safeReplaceTrack (${label}) ABORTED: Sender kind mismatch. Expected "${expectedKind}", but sender is "${senderKind}".`
      );
      return false;
    }

    if (track !== null && track.kind !== expectedKind) {
      console.error(
        `[WebRTC] safeReplaceTrack (${label}) ABORTED: Track kind mismatch. Expected "${expectedKind}", but incoming track is "${track.kind}".`
      );
      return false;
    }

    try {
      await sender.replaceTrack(track);
      return true;
    } catch (err) {
      console.error(`[WebRTC] safeReplaceTrack (${label}) error:`, err);
      return false;
    }
  }, [getSenderKind]);

  /**
   * Close and clean up an individual peer connection when a remote participant departs.
   */
  const closePeerConnection = useCallback((remoteSocketId) => {
    const peerEntry = peersRef.current.get(remoteSocketId);
    if (!peerEntry) return;

    console.log(`[WebRTC] Closing mesh peer connection for ${remoteSocketId}`);

    if (peerEntry.remoteStream) {
      peerEntry.remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    if (peerEntry.pc) {
      peerEntry.pc.onicecandidate = null;
      peerEntry.pc.ontrack = null;
      peerEntry.pc.onconnectionstatechange = null;
      peerEntry.pc.oniceconnectionstatechange = null;
      peerEntry.pc.onnegotiationneeded = null;
      peerEntry.pc.close();
    }

    peersRef.current.delete(remoteSocketId);

    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[remoteSocketId];
      return next;
    });

    setRemoteMediaStates((prev) => {
      const next = { ...prev };
      delete next[remoteSocketId];
      return next;
    });

    setPeerConnectionStates((prev) => {
      const next = { ...prev };
      delete next[remoteSocketId];
      return next;
    });
  }, []);

  /**
   * Initialize a new RTCPeerConnection for a specific remote participant in the mesh.
   */
  const createPeerConnection = useCallback((remoteSocketId) => {
    if (!socket || !selfSocketId || !remoteSocketId) return null;
    if (peersRef.current.has(remoteSocketId)) {
      return peersRef.current.get(remoteSocketId);
    }

    console.log(`[WebRTC] Initializing mesh RTCPeerConnection between ${selfSocketId} and ${remoteSocketId}`);

    // Deterministic politeness rule: lower socket ID is polite
    const isPolite = selfSocketId < remoteSocketId;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const remoteStream = new MediaStream();

    const peerEntry = {
      socketId: remoteSocketId,
      pc,
      remoteStream,
      videoSender: null,
      audioSender: null,
      candidateQueue: [],
      makingOffer: false,
      ignoreOffer: false,
      isPolite,
    };

    peersRef.current.set(remoteSocketId, peerEntry);

    // Initial state setup
    setPeerConnectionStates((prev) => ({ ...prev, [remoteSocketId]: 'new' }));
    setRemoteStreams((prev) => ({ ...prev, [remoteSocketId]: remoteStream }));

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${remoteSocketId} connection state: ${pc.connectionState}`);
      setPeerConnectionStates((prev) => ({ ...prev, [remoteSocketId]: pc.connectionState }));
      if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Peer connection failed with ${remoteSocketId}`);
        setCallError(`P2P connection with a peer failed. Check network or firewall.`);
      } else if (pc.connectionState === 'connected') {
        setCallError(null);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${remoteSocketId} ICE state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected') {
        setPeerConnectionStates((prev) => ({ ...prev, [remoteSocketId]: 'disconnected' }));
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId: remoteSocketId,
          candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack from ${remoteSocketId}: ${event.track.kind} (id: ${event.track.id})`);
      const track = event.track;

      // Avoid duplicate tracks of same kind
      const existing = peerEntry.remoteStream.getTracks().find((t) => t.kind === track.kind);
      if (existing) {
        peerEntry.remoteStream.removeTrack(existing);
      }
      peerEntry.remoteStream.addTrack(track);

      // Trigger re-render with fresh MediaStream instance
      setRemoteStreams((prev) => ({
        ...prev,
        [remoteSocketId]: new MediaStream(peerEntry.remoteStream.getTracks()),
      }));

      track.onended = () => {
        console.log(`[WebRTC] Remote track ended for ${remoteSocketId}: ${track.kind}`);
      };
    };

    // Attach local media tracks using latest stable refs
    const currentStream = localStreamRef.current;
    const currentVideoOn = isVideoOnRef.current;
    const currentMicOn = isMicOnRef.current;
    const currentScreenSharing = isScreenSharingRef.current;

    const audioTrack = currentStream?.getAudioTracks()[0];
    const videoTrack = currentStream?.getVideoTracks()[0];
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0];

    // Audio sender/transceiver
    if (audioTrack) {
      peerEntry.audioSender = pc.addTrack(audioTrack, currentStream);
    } else {
      const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      peerEntry.audioSender = audioTransceiver.sender;
    }

    // Video sender/transceiver
    if (currentScreenSharing && screenTrack) {
      peerEntry.videoSender = pc.addTrack(screenTrack, screenStreamRef.current);
    } else if (currentVideoOn && videoTrack) {
      peerEntry.videoSender = pc.addTrack(videoTrack, currentStream);
    } else {
      const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      peerEntry.videoSender = videoTransceiver.sender;
    }

    // W3C Perfect Negotiation: onnegotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        peerEntry.makingOffer = true;
        await pc.setLocalDescription();
        socket.emit('webrtc-offer', {
          targetSocketId: remoteSocketId,
          sdp: pc.localDescription,
        });
        console.log(`[WebRTC] Sent SDP offer to ${remoteSocketId}`);
      } catch (err) {
        console.error(`[WebRTC] Negotiation offer error with ${remoteSocketId}:`, err);
      } finally {
        peerEntry.makingOffer = false;
      }
    };

    // Send our current local media state to this peer
    socket.emit('webrtc-media-state', {
      targetSocketId: remoteSocketId,
      isVideoOn: currentScreenSharing ? true : currentVideoOn,
      isMicOn: currentMicOn,
      isScreenSharing: Boolean(currentScreenSharing),
    });

    return peerEntry;
  }, [socket, selfSocketId]);

  /**
   * Synchronize active remote participants with peersRef Map:
   * Creates connections for newly joined participants, and tears down
   * departed participants without disrupting remaining connections.
   */
  useEffect(() => {
    if (!socket || !selfSocketId) return;

    const currentRemoteIds = new Set(activeRemoteParticipants.map((p) => p.socketId));

    // 1. Remove peers no longer in room
    for (const [socketId] of peersRef.current) {
      if (!currentRemoteIds.has(socketId)) {
        closePeerConnection(socketId);
      }
    }

    // 2. Initialize new peers
    activeRemoteParticipants.forEach((p) => {
      if (p.socketId && p.socketId !== selfSocketId && !peersRef.current.has(p.socketId)) {
        createPeerConnection(p.socketId);
      }
    });
  }, [socket, selfSocketId, activeRemoteParticipants, createPeerConnection, closePeerConnection]);

  /**
   * Attach global Socket.IO WebRTC signaling event handlers
   */
  useEffect(() => {
    if (!socket) return;

    // Handle incoming SDP Offer
    const handleOffer = async ({ senderSocketId, sdp }) => {
      if (!senderSocketId || !sdp) return;

      console.log(`[WebRTC] Received SDP offer from ${senderSocketId}`);
      let peerEntry = peersRef.current.get(senderSocketId);
      if (!peerEntry) {
        peerEntry = createPeerConnection(senderSocketId);
      }
      if (!peerEntry) return;

      const pc = peerEntry.pc;
      const offerCollision = peerEntry.makingOffer || pc.signalingState !== 'stable';
      peerEntry.ignoreOffer = !peerEntry.isPolite && offerCollision;

      if (peerEntry.ignoreOffer) {
        console.log(`[WebRTC] Offer collision: impolite peer ignoring offer from ${senderSocketId}`);
        return;
      }

      try {
        if (offerCollision && pc.signalingState !== 'stable') {
          console.log(`[WebRTC] Offer collision: polite peer rolling back for ${senderSocketId}`);
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Drain buffered ICE candidates
        while (peerEntry.candidateQueue.length > 0) {
          const queued = peerEntry.candidateQueue.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(queued));
          } catch (e) {
            console.warn(`[WebRTC] Error draining ICE candidate for ${senderSocketId}:`, e);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc-answer', {
          targetSocketId: senderSocketId,
          sdp: pc.localDescription,
        });
        console.log(`[WebRTC] Sent SDP answer to ${senderSocketId}`);
      } catch (err) {
        console.error(`[WebRTC] Error processing offer from ${senderSocketId}:`, err);
      }
    };

    // Handle incoming SDP Answer
    const handleAnswer = async ({ senderSocketId, sdp }) => {
      if (!senderSocketId || !sdp) return;

      console.log(`[WebRTC] Received SDP answer from ${senderSocketId}`);
      const peerEntry = peersRef.current.get(senderSocketId);
      if (!peerEntry) return;

      const pc = peerEntry.pc;
      if (pc.signalingState !== 'have-local-offer') {
        console.warn(`[WebRTC] Ignoring SDP answer from ${senderSocketId}: signalingState is "${pc.signalingState}"`);
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Drain buffered candidates
        while (peerEntry.candidateQueue.length > 0) {
          const queued = peerEntry.candidateQueue.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(queued));
          } catch (e) {
            console.warn(`[WebRTC] Error draining ICE candidate for ${senderSocketId}:`, e);
          }
        }
      } catch (err) {
        console.error(`[WebRTC] Error processing answer from ${senderSocketId}:`, err);
      }
    };

    // Handle incoming remote ICE candidates
    const handleIceCandidate = async ({ senderSocketId, candidate }) => {
      if (!senderSocketId || !candidate) return;

      let peerEntry = peersRef.current.get(senderSocketId);
      if (!peerEntry) {
        peerEntry = createPeerConnection(senderSocketId);
      }
      if (!peerEntry) return;

      const pc = peerEntry.pc;
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          if (!peerEntry.ignoreOffer) {
            console.warn(`[WebRTC] Error adding ICE candidate from ${senderSocketId}:`, err);
          }
        }
      } else {
        peerEntry.candidateQueue.push(candidate);
      }
    };

    // Handle remote media state broadcast
    const handleMediaState = ({ senderSocketId, isVideoOn: remoteVideo, isMicOn: remoteMic, isScreenSharing: remoteScreen }) => {
      if (!senderSocketId) return;
      console.log(`[WebRTC] Remote media state from ${senderSocketId}: video=${remoteVideo}, mic=${remoteMic}, screen=${remoteScreen}`);
      setRemoteMediaStates((prev) => ({
        ...prev,
        [senderSocketId]: {
          isVideoOn: Boolean(remoteVideo),
          isMicOn: Boolean(remoteMic),
          isScreenSharing: Boolean(remoteScreen),
        },
      }));
    };

    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('webrtc-media-state', handleMediaState);

    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('webrtc-media-state', handleMediaState);
    };
  }, [socket, createPeerConnection]);

  /**
   * Stop screen sharing and restore camera across all peers in mesh
   */
  const stopScreenShare = useCallback(async () => {
    console.log('[WebRTC] Stopping screen share across mesh');

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    setScreenError(null);

    const cameraTrack = localStream?.getVideoTracks()[0];
    const shouldRestoreCamera =
      wasCameraOnBeforeSharingRef.current &&
      isVideoOn &&
      cameraTrack &&
      cameraTrack.readyState === 'live' &&
      cameraTrack.kind === 'video';

    // Update video tracks across all active peers
    const replacePromises = [];
    peersRef.current.forEach((peerEntry) => {
      const pc = peerEntry.pc;
      if (!pc || pc.connectionState === 'closed') return;

      const videoSender = getVideoSender(pc, peerEntry);
      if (videoSender) {
        if (shouldRestoreCamera) {
          replacePromises.push(
            safeReplaceTrack(videoSender, cameraTrack, 'video', pc, `stopScreenShare:restoreCamera:${peerEntry.socketId}`)
          );
        } else {
          replacePromises.push(
            safeReplaceTrack(videoSender, null, 'video', pc, `stopScreenShare:clearVideo:${peerEntry.socketId}`)
          );
        }
      }

      if (socket && socket.connected) {
        socket.emit('webrtc-media-state', {
          targetSocketId: peerEntry.socketId,
          isVideoOn: Boolean(shouldRestoreCamera),
          isMicOn,
          isScreenSharing: false,
        });
      }
    });

    await Promise.all(replacePromises);
  }, [localStream, isVideoOn, isMicOn, socket, getVideoSender, safeReplaceTrack]);

  /**
   * Start screen sharing via getDisplayMedia and broadcast to all peers in mesh
   */
  const startScreenShare = useCallback(async () => {
    setScreenError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      const err = 'Screen sharing is not supported in this browser.';
      setScreenError(err);
      return { success: false, error: err };
    }

    try {
      wasCameraOnBeforeSharingRef.current = Boolean(isVideoOn);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        },
        audio: false,
      });

      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack || screenTrack.kind !== 'video') {
        throw new Error('Valid video track not found in screen capture.');
      }

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      screenTrack.onended = () => {
        console.log('[WebRTC] Screen sharing ended by browser native UI');
        stopScreenShare();
      };

      // Hot-swap video sender to screen track on each peer
      const replacePromises = [];
      peersRef.current.forEach((peerEntry) => {
        const pc = peerEntry.pc;
        if (!pc || pc.connectionState === 'closed') return;

        const videoSender = getVideoSender(pc, peerEntry);
        if (videoSender) {
          replacePromises.push(
            safeReplaceTrack(videoSender, screenTrack, 'video', pc, `startScreenShare:${peerEntry.socketId}`).then(
              (replaced) => {
                if (!replaced) {
                  const newSender = pc.addTrack(screenTrack, stream);
                  peerEntry.videoSender = newSender;
                }
              }
            )
          );
        } else {
          const newSender = pc.addTrack(screenTrack, stream);
          peerEntry.videoSender = newSender;
        }

        if (socket && socket.connected) {
          socket.emit('webrtc-media-state', {
            targetSocketId: peerEntry.socketId,
            isVideoOn: true,
            isMicOn,
            isScreenSharing: true,
          });
        }
      });

      await Promise.all(replacePromises);
      return { success: true };
    } catch (err) {
      console.warn('[WebRTC] Screen sharing failed or canceled:', err);
      if (err.name === 'NotAllowedError') {
        return { success: false, canceled: true };
      }
      const msg = err.message || 'Failed to start screen sharing.';
      setScreenError(msg);
      return { success: false, error: msg };
    }
  }, [isVideoOn, isMicOn, socket, stopScreenShare, getVideoSender, safeReplaceTrack]);

  /**
   * Synchronize local camera and microphone track changes with all active peer senders
   */
  useEffect(() => {
    if (!socket || peersRef.current.size === 0) return;

    const audioTrack = localStream?.getAudioTracks()[0] || null;
    const videoTrack = localStream?.getVideoTracks()[0] || null;

    peersRef.current.forEach((peerEntry) => {
      const pc = peerEntry.pc;
      if (!pc || pc.connectionState === 'closed') return;

      // 1. Update Video Sender if screen sharing is not currently controlling the video track
      if (!isScreenSharing) {
        const videoSender = getVideoSender(pc, peerEntry);
        if (videoSender) {
          if (isVideoOn && videoTrack && videoTrack.readyState === 'live' && videoTrack.kind === 'video') {
            safeReplaceTrack(videoSender, videoTrack, 'video', pc, `syncCameraOn:${peerEntry.socketId}`);
          } else {
            safeReplaceTrack(videoSender, null, 'video', pc, `syncCameraOff:${peerEntry.socketId}`);
          }
        } else if (isVideoOn && videoTrack && videoTrack.kind === 'video') {
          peerEntry.videoSender = pc.addTrack(videoTrack, localStream);
        }
      }

      // 2. Update Audio Sender
      const audioSender = getAudioSender(pc, peerEntry);
      if (audioSender) {
        if (audioTrack && audioTrack.readyState === 'live' && audioTrack.kind === 'audio') {
          safeReplaceTrack(audioSender, audioTrack, 'audio', pc, `syncMicTrack:${peerEntry.socketId}`);
        } else {
          safeReplaceTrack(audioSender, null, 'audio', pc, `syncMicNull:${peerEntry.socketId}`);
        }
      } else if (audioTrack && audioTrack.kind === 'audio') {
        peerEntry.audioSender = pc.addTrack(audioTrack, localStream);
      }

      // 3. Notify remote peer of updated media state
      if (socket.connected) {
        socket.emit('webrtc-media-state', {
          targetSocketId: peerEntry.socketId,
          isVideoOn: isScreenSharing ? true : isVideoOn,
          isMicOn,
          isScreenSharing: Boolean(isScreenSharing),
        });
      }
    });
  }, [socket, localStream, isVideoOn, isMicOn, isScreenSharing, getVideoSender, getAudioSender, safeReplaceTrack]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log('[WebRTC] Unmounting useWebRTC: cleaning up all mesh peer connections');
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          track.onended = null;
          track.stop();
        });
        screenStreamRef.current = null;
      }
      peersRef.current.forEach((peerEntry) => {
        if (peerEntry.remoteStream) {
          peerEntry.remoteStream.getTracks().forEach((t) => t.stop());
        }
        if (peerEntry.pc) {
          peerEntry.pc.onicecandidate = null;
          peerEntry.pc.ontrack = null;
          peerEntry.pc.onconnectionstatechange = null;
          peerEntry.pc.oniceconnectionstatechange = null;
          peerEntry.pc.onnegotiationneeded = null;
          peerEntry.pc.close();
        }
      });
      peersRef.current.clear();
    };
  }, []);

  // Number of peers in connected state
  const connectedPeerCount = useMemo(() => {
    return Object.values(peerConnectionStates).filter((s) => s === 'connected').length;
  }, [peerConnectionStates]);

  const isCallActive = connectedPeerCount > 0;

  // Primary remote stream and states (for backward compatibility)
  const firstRemoteSocketId = activeRemoteParticipants[0]?.socketId;
  const primaryRemoteStream = firstRemoteSocketId ? remoteStreams[firstRemoteSocketId] || null : null;
  const primaryRemoteMediaState = firstRemoteSocketId
    ? remoteMediaStates[firstRemoteSocketId] || { isVideoOn: false, isMicOn: false, isScreenSharing: false }
    : { isVideoOn: false, isMicOn: false, isScreenSharing: false };
  const primaryPeerConnectionState = firstRemoteSocketId
    ? peerConnectionStates[firstRemoteSocketId] || 'new'
    : 'new';

  return {
    // Multi-peer Mesh properties
    remoteStreams,
    remoteMediaStates,
    peerConnectionStates,
    connectedPeerCount,

    // Backward-compatible single-peer properties
    remoteStream: primaryRemoteStream,
    remoteMediaState: primaryRemoteMediaState,
    peerConnectionState: primaryPeerConnectionState,
    isCallActive,
    callError,

    // Screen sharing
    isScreenSharing,
    screenStream,
    screenError,
    startScreenShare,
    stopScreenShare,
  };
};

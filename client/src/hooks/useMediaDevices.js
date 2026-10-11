import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage local camera and microphone hardware tracks.
 * Handles permission requests, full camera lifecycle (stopping tracks on disable to release hardware),
 * independent microphone control, hardware device enumeration, and clean resource disposal.
 */
export const useMediaDevices = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [micError, setMicError] = useState(null);

  // Available hardware devices
  const [devices, setDevices] = useState({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');

  // Real-time audio volume level (0 - 100) measured via Web Audio API
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs to manage streams and avoid stale closures
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Enumerate connected devices and filter by kind
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList.filter((d) => d.kind === 'audioinput');
      const videoInputs = deviceList.filter((d) => d.kind === 'videoinput');
      const audioOutputs = deviceList.filter((d) => d.kind === 'audiooutput');

      setDevices({ audioInputs, videoInputs, audioOutputs });

      if (audioInputs.length > 0 && !selectedAudioId) {
        setSelectedAudioId(audioInputs[0].deviceId);
      }
      if (videoInputs.length > 0 && !selectedVideoId) {
        setSelectedVideoId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
    }
  }, [selectedAudioId, selectedVideoId]);

  // Stop every remaining local track (called on unmount or when leaving the room)
  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    setLocalStream(null);
    setIsVideoOn(false);
    setIsMicOn(false);
    setAudioLevel(0);

    // Clean up AudioContext
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Web Audio API analyzer for real mic input levels
  const setupAudioAnalyser = useCallback((stream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setAudioLevel(0);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      // Cancel any running measurement loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const audioSource = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      audioSource.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const measure = () => {
        if (!streamRef.current || !audioTrack.enabled || audioTrack.readyState === 'ended') {
          setAudioLevel(0);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.max(0, Math.round((avg / 90) * 100)));
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(measure);
      };

      measure();
    } catch (err) {
      console.warn('AudioAnalyser could not be initialized:', err);
    }
  }, []);

  /**
   * Camera Lifecycle Management:
   * - When turning OFF: stops the active video track completely, releases the camera hardware,
   *   and removes the track from the stream without touching audio.
   * - When turning ON: requests/reacquires a fresh camera stream, adds the track to the stream,
   *   and restores the preview.
   */
  const toggleCamera = useCallback(async () => {
    setCameraError(null);

    // 1. If camera is currently ON, turn it OFF by stopping the video track
    if (isVideoOn) {
      const currentStream = streamRef.current;
      if (currentStream) {
        const existingVideoTrack = currentStream.getVideoTracks()[0];
        if (existingVideoTrack) {
          // Explicitly stop the capture track to release the physical hardware camera
          existingVideoTrack.stop();
          currentStream.removeTrack(existingVideoTrack);
        }

        // If there are remaining tracks (e.g. microphone audio), keep the stream alive
        if (currentStream.getTracks().length > 0) {
          setLocalStream(new MediaStream(currentStream.getTracks()));
        } else {
          streamRef.current = null;
          setLocalStream(null);
        }
      }

      setIsVideoOn(false);
      return { success: true, enabled: false };
    }

    // 2. If camera is currently OFF, request/reacquire the camera stream
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Camera API is not supported in this browser environment.';
      setCameraError(err);
      return { success: false, error: err };
    }

    setIsLoadingMedia(true);
    try {
      const constraints = {
        video: selectedVideoId
          ? { deviceId: { exact: selectedVideoId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const newVideoStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newVideoTrack = newVideoStream.getVideoTracks()[0];

      // If user unplugs camera or revokes permission via browser UI
      newVideoTrack.onended = () => {
        setIsVideoOn(false);
      };

      if (!streamRef.current) {
        streamRef.current = new MediaStream([newVideoTrack]);
      } else {
        // Ensure no old/stale video tracks remain
        streamRef.current.getVideoTracks().forEach((t) => {
          streamRef.current.removeTrack(t);
          t.stop();
        });
        streamRef.current.addTrack(newVideoTrack);
      }

      setLocalStream(new MediaStream(streamRef.current.getTracks()));
      setIsVideoOn(true);
      setCameraError(null);
      await refreshDevices();
      return { success: true, enabled: true };
    } catch (err) {
      console.error('Camera access error:', err);
      let userFriendlyMessage = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendlyMessage = 'Camera permission denied. Please allow camera access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userFriendlyMessage = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userFriendlyMessage = 'Camera is already in use by another application.';
      }
      setCameraError(userFriendlyMessage);
      setIsVideoOn(false);
      return { success: false, error: userFriendlyMessage };
    } finally {
      setIsLoadingMedia(false);
    }
  }, [isVideoOn, selectedVideoId, refreshDevices]);

  /**
   * Microphone Management:
   * Works completely independently of camera.
   * Toggles audioTrack.enabled without interrupting or modifying video tracks.
   */
  const toggleMicrophone = useCallback(async () => {
    setMicError(null);

    // 1. If an audio track already exists
    const currentStream = streamRef.current;
    const existingAudioTrack = currentStream ? currentStream.getAudioTracks()[0] : null;

    if (existingAudioTrack && existingAudioTrack.readyState !== 'ended') {
      const nextState = !existingAudioTrack.enabled;
      existingAudioTrack.enabled = nextState;
      setIsMicOn(nextState);

      if (nextState) {
        setupAudioAnalyser(currentStream);
      } else {
        setAudioLevel(0);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      }
      return { success: true, enabled: nextState };
    }

    // 2. Hardware audio track does not exist yet: request microphone access
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Microphone API is not supported in this browser environment.';
      setMicError(err);
      return { success: false, error: err };
    }

    setIsLoadingMedia(true);
    try {
      const constraints = {
        audio: selectedAudioId
          ? {
              deviceId: { exact: selectedAudioId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
      };

      const newAudioStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newAudioTrack = newAudioStream.getAudioTracks()[0];

      newAudioTrack.onended = () => {
        setIsMicOn(false);
        setAudioLevel(0);
      };

      if (!streamRef.current) {
        streamRef.current = new MediaStream([newAudioTrack]);
      } else {
        streamRef.current.getAudioTracks().forEach((t) => {
          streamRef.current.removeTrack(t);
          t.stop();
        });
        streamRef.current.addTrack(newAudioTrack);
      }

      setLocalStream(new MediaStream(streamRef.current.getTracks()));
      setIsMicOn(true);
      setMicError(null);
      setupAudioAnalyser(streamRef.current);
      await refreshDevices();
      return { success: true, enabled: true };
    } catch (err) {
      console.error('Microphone access error:', err);
      let userFriendlyMessage = 'Failed to access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendlyMessage = 'Microphone permission denied. Please allow microphone access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userFriendlyMessage = 'No microphone device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userFriendlyMessage = 'Microphone is already in use by another application.';
      }
      setMicError(userFriendlyMessage);
      setIsMicOn(false);
      setAudioLevel(0);
      return { success: false, error: userFriendlyMessage };
    } finally {
      setIsLoadingMedia(false);
    }
  }, [selectedAudioId, refreshDevices, setupAudioAnalyser]);

  // Switch camera hardware device dynamically
  const switchCameraDevice = useCallback(async (deviceId) => {
    setSelectedVideoId(deviceId);
    if (!isVideoOn || !streamRef.current) return;

    const currentVideoTrack = streamRef.current.getVideoTracks()[0];
    try {
      setIsLoadingMedia(true);
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newTrack = newStream.getVideoTracks()[0];

      if (currentVideoTrack) {
        currentVideoTrack.stop();
        streamRef.current.removeTrack(currentVideoTrack);
      }
      streamRef.current.addTrack(newTrack);

      setLocalStream(new MediaStream(streamRef.current.getTracks()));
    } catch (err) {
      console.error('Failed to switch camera device:', err);
    } finally {
      setIsLoadingMedia(false);
    }
  }, [isVideoOn]);

  // Switch microphone hardware device dynamically
  const switchAudioDevice = useCallback(async (deviceId) => {
    setSelectedAudioId(deviceId);
    if (!isMicOn || !streamRef.current) return;

    const currentAudioTrack = streamRef.current.getAudioTracks()[0];
    try {
      setIsLoadingMedia(true);
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true },
      });
      const newTrack = newStream.getAudioTracks()[0];

      if (currentAudioTrack) {
        currentAudioTrack.stop();
        streamRef.current.removeTrack(currentAudioTrack);
      }
      streamRef.current.addTrack(newTrack);

      setLocalStream(new MediaStream(streamRef.current.getTracks()));
      setupAudioAnalyser(streamRef.current);
    } catch (err) {
      console.error('Failed to switch audio device:', err);
    } finally {
      setIsLoadingMedia(false);
    }
  }, [isMicOn, setupAudioAnalyser]);

  // Listen to device change events
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDeviceChange = () => {
        refreshDevices();
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [refreshDevices]);

  // Initial enumeration
  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // Cleanup on unmount: stops every remaining track
  useEffect(() => {
    return () => {
      stopAllTracks();
    };
  }, [stopAllTracks]);

  return {
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
    refreshDevices,
  };
};

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useToast } from '../components/common/Toast';

/**
 * Custom hook to manage Socket.IO real-time room membership.
 * Handles connecting to the signaling server, joining the room, tracking
 * real server-side participant membership, and graceful teardown on exit.
 */
export const useRoomSocket = (roomId, initialDisplayName = 'You') => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected' | 'error'
  const [participants, setParticipants] = useState([]);
  const [participantCount, setParticipantCount] = useState(1);
  const [socketError, setSocketError] = useState(null);
  const [selfInfo, setSelfInfo] = useState(null);
  const [isOverCapacity, setIsOverCapacity] = useState(false);
  const [initialMessages, setInitialMessages] = useState([]);

  const socketRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!roomId) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';
    setConnectionStatus('connecting');
    setSocketError(null);

    // Initialize socket connection
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Connected to server
    socketInstance.on('connect', () => {
      console.log(`[Socket] Connected to server with ID: ${socketInstance.id}`);
      setConnectionStatus('connected');

      // Emit join-room request
      socketInstance.emit('join-room', {
        roomId,
        displayName: initialDisplayName,
      });
    });

    // Successfully joined room
    socketInstance.on('room-joined', ({ roomId: joinedRoomId, self, participants: serverList, participantCount: count, isOverCapacity: overCap, messages: serverMessages }) => {
      console.log(`[Socket] Joined room ${joinedRoomId} as ${self.displayName}`);
      setSelfInfo(self);
      setParticipantCount(count);
      setIsOverCapacity(Boolean(overCap || count >= 4));
      setInitialMessages(serverMessages || []);

      // Map participants and mark local user
      const mapped = (serverList || []).map((p) => ({
        ...p,
        isLocal: p.socketId === self.socketId,
        displayName: p.socketId === self.socketId ? 'You' : p.displayName,
      }));

      setParticipants(mapped);
      setConnectionStatus('connected');
    });

    // Capacity notice when room reaches 4 participants
    socketInstance.on('room-capacity-notice', ({ message }) => {
      setIsOverCapacity(true);
      addToast(message || 'This room is now at maximum capacity (4 participants).', 'warning', 6000);
    });

    // Remote participant joined
    socketInstance.on('participant-joined', ({ participant, participantCount: count }) => {
      console.log(`[Socket] Participant joined: ${participant.displayName} (${participant.socketId})`);
      setParticipantCount(count);
      if (count >= 4) {
        setIsOverCapacity(true);
      }

      setParticipants((prev) => {
        // Prevent duplicate entries
        if (prev.some((p) => p.socketId === participant.socketId)) {
          return prev;
        }
        return [...prev, { ...participant, isLocal: false }];
      });

      addToast(`${participant.displayName} joined the meeting`, 'info', 3500);
    });

    // Remote participant left
    socketInstance.on('participant-left', ({ participant, participantCount: count, remainingParticipants }) => {
      console.log(`[Socket] Participant left: ${participant.displayName || participant.socketId}`);
      setParticipantCount(count);
      if (count < 4) {
        setIsOverCapacity(false);
      }

      if (remainingParticipants && Array.isArray(remainingParticipants)) {
        setParticipants((prev) => {
          const selfItem = prev.find((p) => p.isLocal);
          const mapped = remainingParticipants.map((p) => ({
            ...p,
            isLocal: selfItem ? p.socketId === selfItem.socketId : false,
            displayName: selfItem && p.socketId === selfItem.socketId ? 'You' : p.displayName,
          }));
          return mapped;
        });
      } else {
        setParticipants((prev) => prev.filter((p) => p.socketId !== participant.socketId));
      }

      addToast(`${participant.displayName || 'A participant'} left the meeting`, 'info', 3500);
    });

    // Room join error
    socketInstance.on('room-error', ({ message }) => {
      console.error(`[Socket] Room error: ${message}`);
      setSocketError(message);
      setConnectionStatus('error');
      addToast(message || 'Failed to join meeting room', 'danger');
    });

    // Disconnect handling
    socketInstance.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      setConnectionStatus('disconnected');
    });

    // Connection error handling
    socketInstance.on('connect_error', (err) => {
      console.warn(`[Socket] Connection error:`, err.message);
      setConnectionStatus('error');
      setSocketError('Unable to connect to real-time meeting server');
    });

    // Cleanup on unmount or roomId change
    return () => {
      console.log('[Socket] Cleaning up socket connection on unmount/leave');
      if (socketInstance.connected) {
        socketInstance.emit('leave-room');
      }
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [roomId, initialDisplayName, addToast]);

  // Explicit leave room action
  const leaveRoom = useCallback(() => {
    if (socketRef.current) {
      if (socketRef.current.connected) {
        socketRef.current.emit('leave-room');
      }
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
  }, []);

  return {
    socket,
    connectionStatus,
    participants,
    participantCount,
    socketError,
    selfInfo,
    isOverCapacity,
    initialMessages,
    leaveRoom,
  };
};

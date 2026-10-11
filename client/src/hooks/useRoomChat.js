import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for real-time in-meeting text chat.
 * Integrates with the existing Socket.IO connection, enforces client-side
 * input constraints (1-1000 chars), de-duplicates messages by unique ID,
 * maintains unread counts when drawer is closed, and cleans up listeners safely.
 */
export const useRoomChat = ({
  socket,
  roomId,
  selfSocketId,
  isDrawerOpen = false,
  initialMessages = [],
}) => {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const isDrawerOpenRef = useRef(isDrawerOpen);
  isDrawerOpenRef.current = isDrawerOpen;

  // Hydrate with initial messages received when joining room
  useEffect(() => {
    if (Array.isArray(initialMessages) && initialMessages.length > 0) {
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = initialMessages.filter((m) => !existingIds.has(m.id));
        if (newOnes.length === 0) return prev;
        return [...prev, ...newOnes];
      });
    }
  }, [initialMessages]);

  // Reset unread count when user opens chat drawer
  useEffect(() => {
    if (isDrawerOpen) {
      setUnreadCount(0);
      setSendError(null);
    }
  }, [isDrawerOpen]);

  // Real-time chat socket event listeners
  useEffect(() => {
    if (!socket || !roomId) {
      return;
    }

    const handleChatMessage = (incomingMessage) => {
      if (!incomingMessage || !incomingMessage.id) return;

      // Room isolation check: ensure message belongs to the current room
      if (incomingMessage.roomId && incomingMessage.roomId !== roomId) {
        return;
      }

      setMessages((prev) => {
        // Prevent duplicate messages
        if (prev.some((m) => m.id === incomingMessage.id)) {
          return prev;
        }
        return [...prev, incomingMessage];
      });

      // Increment unread count if drawer is closed and message is not from self
      if (!isDrawerOpenRef.current && incomingMessage.senderSocketId !== selfSocketId) {
        setUnreadCount((count) => count + 1);
      }
    };

    const handleChatError = ({ message } = {}) => {
      console.warn('[Chat] Socket chat error:', message);
      setSendError(message || 'Failed to send message.');
      setIsSending(false);
    };

    socket.on('chat-message', handleChatMessage);
    socket.on('chat-error', handleChatError);

    return () => {
      socket.off('chat-message', handleChatMessage);
      socket.off('chat-error', handleChatError);
    };
  }, [socket, roomId, selfSocketId]);

  // Send message action
  const sendMessage = useCallback(
    async (text) => {
      if (!socket || !socket.connected) {
        setSendError('Not connected to meeting server.');
        return false;
      }

      if (typeof text !== 'string') {
        setSendError('Invalid message format.');
        return false;
      }

      const trimmed = text.trim();
      if (trimmed.length === 0) {
        setSendError('Message cannot be empty.');
        return false;
      }

      if (trimmed.length > 1000) {
        setSendError('Message exceeds maximum limit of 1,000 characters.');
        return false;
      }

      setIsSending(true);
      setSendError(null);

      return new Promise((resolve) => {
        let isSettled = false;

        const timer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            setIsSending(false);
            setSendError('Message timed out. Please check your connection.');
            resolve(false);
          }
        }, 5000);

        socket.emit(
          'send-chat-message',
          { roomId, text: trimmed },
          (response) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timer);
            setIsSending(false);
            if (response && response.success) {
              setSendError(null);
              resolve(true);
            } else {
              const err = response?.error || 'Failed to send message.';
              setSendError(err);
              resolve(false);
            }
          }
        );
      });
    },
    [socket, roomId]
  );

  const clearError = useCallback(() => {
    setSendError(null);
  }, []);

  return {
    messages,
    unreadCount,
    isSending,
    sendError,
    sendMessage,
    clearError,
  };
};

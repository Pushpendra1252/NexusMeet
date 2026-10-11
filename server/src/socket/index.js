import { roomManager } from './roomManager.js';

/**
 * Configure Socket.IO real-time room signaling and WebRTC peer negotiation.
 */
export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join room event
    socket.on('join-room', ({ roomId, displayName } = {}) => {
      console.log(`[Socket.IO] join-room request: socket=${socket.id}, room=${roomId}, name=${displayName}`);

      const result = roomManager.joinRoom(roomId, socket.id, displayName);

      if (!result.success) {
        socket.emit('room-error', { message: result.error || 'Failed to join room' });
        return;
      }

      // Join the Socket.IO room channel
      socket.join(result.roomId);

      // Send the complete current participant list and active room messages to the joining user
      socket.emit('room-joined', {
        roomId: result.roomId,
        self: result.participant,
        participants: result.participants,
        participantCount: result.participantCount,
        isAtCapacity: result.isAtCapacity,
        isOverCapacity: result.isOverCapacity,
        messages: result.messages || [],
      });

      // If room has reached maximum capacity of 4, notify the room
      if (result.isAtCapacity) {
        socket.emit('room-capacity-notice', {
          message: 'NexusMeet room is currently at maximum capacity (4 participants).',
        });
      }

      // Notify everyone else in the room that a new participant has joined
      socket.to(result.roomId).emit('participant-joined', {
        participant: result.participant,
        participantCount: result.participantCount,
      });

      console.log(
        `[Socket.IO] ${result.participant.displayName} (${socket.id}) entered room "${result.roomId}". Total: ${result.participantCount}`
      );
    });

    // WebRTC Signaling: SDP Offer exchange
    socket.on('webrtc-offer', ({ targetSocketId, sdp } = {}) => {
      if (typeof targetSocketId !== 'string' || !sdp || typeof sdp !== 'object' || typeof sdp.type !== 'string' || typeof sdp.sdp !== 'string') {
        return;
      }

      // Validate both peers belong to the exact same room
      if (!roomManager.areInSameRoom(socket.id, targetSocketId)) {
        console.warn(`[WebRTC] Rejected offer: ${socket.id} and ${targetSocketId} are not in the same room`);
        return;
      }

      io.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        sdp,
      });
    });

    // WebRTC Signaling: SDP Answer exchange
    socket.on('webrtc-answer', ({ targetSocketId, sdp } = {}) => {
      if (typeof targetSocketId !== 'string' || !sdp || typeof sdp !== 'object' || typeof sdp.type !== 'string' || typeof sdp.sdp !== 'string') {
        return;
      }

      // Validate both peers belong to the exact same room
      if (!roomManager.areInSameRoom(socket.id, targetSocketId)) {
        console.warn(`[WebRTC] Rejected answer: ${socket.id} and ${targetSocketId} are not in the same room`);
        return;
      }

      io.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        sdp,
      });
    });

    // WebRTC Signaling: ICE Candidate exchange
    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate } = {}) => {
      if (typeof targetSocketId !== 'string' || !candidate || typeof candidate !== 'object') {
        return;
      }

      if (!roomManager.areInSameRoom(socket.id, targetSocketId)) {
        return;
      }

      io.to(targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // WebRTC Media State Synchronization (informs peer when camera/mic/screen share is toggled)
    socket.on('webrtc-media-state', ({ targetSocketId, isVideoOn, isMicOn, isScreenSharing } = {}) => {
      if (targetSocketId) {
        if (typeof targetSocketId !== 'string') return;
        if (!roomManager.areInSameRoom(socket.id, targetSocketId)) {
          return;
        }

        io.to(targetSocketId).emit('webrtc-media-state', {
          senderSocketId: socket.id,
          isVideoOn: Boolean(isVideoOn),
          isMicOn: Boolean(isMicOn),
          isScreenSharing: Boolean(isScreenSharing),
        });
      } else {
        const roomId = roomManager.getRoomIdForSocket(socket.id);
        if (roomId) {
          socket.to(roomId).emit('webrtc-media-state', {
            senderSocketId: socket.id,
            isVideoOn: Boolean(isVideoOn),
            isMicOn: Boolean(isMicOn),
            isScreenSharing: Boolean(isScreenSharing),
          });
        }
      }
    });

    // In-Meeting Real-Time Text Chat
    socket.on('send-chat-message', ({ roomId, text } = {}, callback) => {
      // 1. Verify that sender is currently a registered member of this room
      const currentRoomId = roomManager.getRoomIdForSocket(socket.id);
      if (!currentRoomId || currentRoomId !== roomId) {
        const errorMsg = 'Unauthorized: You are not a member of this room.';
        console.warn(`[Chat] Rejected message from ${socket.id}: room mismatch or not joined (${roomId})`);
        if (typeof callback === 'function') {
          callback({ success: false, error: errorMsg });
        }
        socket.emit('chat-error', { message: errorMsg });
        return;
      }

      // 2. Validate message text payload
      if (typeof text !== 'string') {
        const errorMsg = 'Invalid message payload.';
        if (typeof callback === 'function') {
          callback({ success: false, error: errorMsg });
        }
        socket.emit('chat-error', { message: errorMsg });
        return;
      }

      const trimmedText = text.trim();

      // 3. Reject empty messages
      if (trimmedText.length === 0) {
        const errorMsg = 'Message cannot be empty.';
        if (typeof callback === 'function') {
          callback({ success: false, error: errorMsg });
        }
        socket.emit('chat-error', { message: errorMsg });
        return;
      }

      // 4. Enforce 1,000 character maximum length
      if (trimmedText.length > 1000) {
        const errorMsg = 'Message exceeds maximum length of 1,000 characters.';
        if (typeof callback === 'function') {
          callback({ success: false, error: errorMsg });
        }
        socket.emit('chat-error', { message: errorMsg });
        return;
      }

      // 5. Authoritatively resolve sender display name from server room state
      const senderDisplayName = roomManager.getSenderDisplayName(roomId, socket.id);

      // 6. Build verified message payload with server-generated ID and timestamp
      const messagePayload = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        roomId,
        senderSocketId: socket.id,
        senderName: senderDisplayName,
        text: trimmedText,
        timestamp: new Date().toISOString(),
      };

      // 7. Store in active room memory for current session
      roomManager.addChatMessage(roomId, messagePayload);

      // 8. Broadcast strictly to members of this room
      io.to(roomId).emit('chat-message', messagePayload);

      // 9. Acknowledge delivery to sender if callback provided
      if (typeof callback === 'function') {
        callback({ success: true, message: messagePayload });
      }

      console.log(
        `[Chat] [${roomId}] ${senderDisplayName} (${socket.id}): ${trimmedText.slice(0, 40)}${trimmedText.length > 40 ? '...' : ''}`
      );
    });

    // Explicit leave room event
    socket.on('leave-room', () => {
      const result = roomManager.leaveRoom(socket.id);

      if (result) {
        socket.leave(result.roomId);
        socket.emit('room-left', { roomId: result.roomId });

        // Notify remaining members
        socket.to(result.roomId).emit('participant-left', {
          participant: result.departed,
          participantCount: result.participantCount,
          remainingParticipants: result.remainingParticipants,
        });

        console.log(
          `[Socket.IO] ${result.departed.displayName || socket.id} left room "${result.roomId}". Remaining: ${result.participantCount}`
        );
      }
    });

    // Handle client disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);

      const result = roomManager.leaveRoom(socket.id);

      if (result) {
        socket.to(result.roomId).emit('participant-left', {
          participant: result.departed,
          participantCount: result.participantCount,
          remainingParticipants: result.remainingParticipants,
        });

        console.log(
          `[Socket.IO] Disconnected user removed from room "${result.roomId}". Remaining: ${result.participantCount}`
        );
      }
    });
  });
};

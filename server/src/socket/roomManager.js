/**
 * In-memory room membership tracker for NexusMeet.
 * Validates inputs, manages socket-to-room mappings, avoids duplicate registrations,
 * ensures secure peer validation for WebRTC signaling, and maintains accurate participant states.
 */

class RoomManager {
  constructor() {
    // roomId -> Map<socketId, { socketId, displayName, joinedAt }>
    this.rooms = new Map();
    // socketId -> roomId
    this.socketToRoom = new Map();
    // roomId -> Array<message> (in-memory for active sessions, capped to 50)
    this.roomMessages = new Map();
  }

  /**
   * Validate meeting ID format (alphanumeric, dashes, underscores, 3-64 chars)
   */
  isValidRoomId(roomId) {
    if (typeof roomId !== 'string') return false;
    const trimmed = roomId.trim();
    return /^[a-zA-Z0-9_-]{3,64}$/.test(trimmed);
  }

  /**
   * Sanitize and format display name with safe fallback
   */
  sanitizeDisplayName(name, socketId) {
    const fallback = `Guest ${socketId.substring(0, 4)}`;
    if (typeof name !== 'string') return fallback;
    const clean = name.trim().replace(/[<>]/g, ''); // Basic XSS sanitization
    if (!clean) return fallback;
    return clean.slice(0, 32);
  }

  /**
   * Add a socket to a room with validation and duplicate prevention
   */
  joinRoom(rawRoomId, socketId, rawDisplayName) {
    if (!this.isValidRoomId(rawRoomId)) {
      return { success: false, error: 'Invalid room ID format' };
    }

    const roomId = rawRoomId.trim();
    const displayName = this.sanitizeDisplayName(rawDisplayName, socketId);

    // If socket is already in a different room, leave it first
    const previousRoomId = this.socketToRoom.get(socketId);
    if (previousRoomId && previousRoomId !== roomId) {
      this.leaveRoom(socketId);
    }

    // Get or initialize the room map
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const room = this.rooms.get(roomId);

    // Enforce maximum capacity of 4 participants per room
    const MAX_ROOM_CAPACITY = 4;
    if (room.size >= MAX_ROOM_CAPACITY && !room.has(socketId)) {
      return {
        success: false,
        error: 'Room is at full capacity (maximum 4 participants).',
      };
    }

    // Create participant entry
    const participant = {
      socketId,
      displayName,
      joinedAt: new Date().toISOString()
    };

    // Prevent duplicate entries by setting keyed on socketId
    room.set(socketId, participant);
    this.socketToRoom.set(socketId, roomId);

    const participants = Array.from(room.values());
    const participantCount = room.size;
    const messages = this.getChatMessages(roomId);

    return {
      success: true,
      roomId,
      participant,
      participants,
      participantCount,
      isAtCapacity: participantCount >= MAX_ROOM_CAPACITY,
      isOverCapacity: participantCount > MAX_ROOM_CAPACITY,
      messages,
    };
  }

  /**
   * Remove a socket from its active room
   */
  leaveRoom(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    let departedParticipant = null;

    if (room) {
      departedParticipant = room.get(socketId) || { socketId };
      room.delete(socketId);

      // Clean up empty rooms to avoid memory leaks
      if (room.size === 0) {
        this.rooms.delete(roomId);
        this.roomMessages.delete(roomId);
      }
    }

    this.socketToRoom.delete(socketId);

    const remainingParticipants = room ? Array.from(room.values()) : [];
    const participantCount = remainingParticipants.length;

    return {
      roomId,
      departed: departedParticipant,
      remainingParticipants,
      participantCount
    };
  }

  /**
   * Get all participants currently in a room
   */
  getRoomParticipants(roomId) {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.values()) : [];
  }

  /**
   * Get current real count of participants in a room
   */
  getRoomCount(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.size : 0;
  }

  /**
   * Get room ID for a specific socket
   */
  getRoomIdForSocket(socketId) {
    return this.socketToRoom.get(socketId) || null;
  }

  /**
   * Resolve authoritative sender display name from room membership
   */
  getSenderDisplayName(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (room && room.has(socketId)) {
      return room.get(socketId).displayName;
    }
    return `Guest ${socketId.substring(0, 4)}`;
  }

  /**
   * Store a chat message in active room memory (capped at 50 messages)
   */
  addChatMessage(roomId, message) {
    if (!this.roomMessages.has(roomId)) {
      this.roomMessages.set(roomId, []);
    }
    const messages = this.roomMessages.get(roomId);
    messages.push(message);
    if (messages.length > 50) {
      messages.shift();
    }
  }

  /**
   * Retrieve active chat messages for a room
   */
  getChatMessages(roomId) {
    return this.roomMessages.get(roomId) || [];
  }

  /**
   * Validate that both sockets are present and belong to the exact same room.
   * Prevents arbitrary or cross-room signaling.
   */
  areInSameRoom(socketId1, socketId2) {
    if (!socketId1 || !socketId2) return false;
    const room1 = this.socketToRoom.get(socketId1);
    const room2 = this.socketToRoom.get(socketId2);
    return Boolean(room1 && room2 && room1 === room2);
  }
}

export const roomManager = new RoomManager();

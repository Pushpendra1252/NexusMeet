# NexusMeet — Modern Real-Time Video Conferencing

NexusMeet is a production-style, browser-based video conferencing application inspired by Google Meet and Zoom. Built from the ground up using **React (Vite)**, **Tailwind CSS**, **Node.js/Express**, **Socket.IO**, and **native WebRTC**, NexusMeet supports multi-participant audio/video calls, real-time screen sharing, in-meeting text chat, and hardware lifecycle controls with an original, modern dark-mode user interface.

---

## Key Features

* **Multi-Participant Full-Mesh Calling**: Peer-to-peer audio and video calling supporting up to **4 participants** per room with direct encrypted media streams.
* **Dynamic Adaptive Video Grid**: Responsive grid canvas that automatically adapts its layout for 1, 2, 3, or 4 participants with smooth transitions and status overlays.
* **Hardware Lifecycle Management**: Genuine physical webcam release upon turning off video (shutting off the physical webcam indicator LED) and independent microphone mute/unmute controls.
* **Real-Time Screen Sharing**: Browser-based display capture via `navigator.mediaDevices.getDisplayMedia` with seamless `RTCRtpSender.replaceTrack()` hot-swapping and native browser "Stop sharing" detection.
* **In-Meeting Text Chat**: Server-validated real-time text chat (1–1,000 characters) with strict room isolation, message de-duplication, and unread counter badges.
* **Robust WebRTC Signaling**: Deterministic politeness rule (W3C Perfect Negotiation) to eliminate offer collisions (glare), safe ICE candidate queuing, and transceiver-based kind-safe track replacement.
* **Hardware & Audio Diagnostics**: Modal for switching cameras, microphones, and audio outputs with a live Web Audio API volume level meter.

---

## Technologies Used

| Technology | Role in Architecture |
| :--- | :--- |
| **React 18 & Vite 5** | Frontend component tree, reactive state management, and high-performance client build tooling. |
| **Tailwind CSS** | Styling system implementing an original dark-mode palette, glowing accents, and responsive layout grids. |
| **WebRTC API** | Direct browser-to-browser audio, video, and screen sharing transport (`RTCPeerConnection`, `RTCRtpSender`). |
| **Socket.IO (Client & Server)** | Real-time bi-directional signaling channel for SDP offers/answers, ICE candidates, media state sync, and chat messages. |
| **Node.js & Express 4** | Signaling server backend, HTTP server hosting Socket.IO, and health check REST endpoints. |
| **Web Audio API** | Real-time microphone audio volume measurement (`AudioContext`, `AnalyserNode`) and input meter visualization. |
| **Lucide React** | Consistent, lightweight SVG iconography for in-call controls and navigation. |

---

## Architectural Overview

NexusMeet separates **Signaling (Control Plane)** from **Media Transport (Data Plane)**:

```
                      +-----------------------------+
                      |   Node.js / Express Server  |
                      |   Socket.IO Signaling & Chat|
                      +--------------+--------------+
                                     ^
                         Signaling   |   Signaling
                        (WebSockets) |  (WebSockets)
                                     v
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+------------------+     Direct P2P Encrypted Media      +------------------+
|  Participant A   |<===================================>|  Participant B   |
| (Browser Client) |         (WebRTC / SRTP Mesh)        | (Browser Client) |
+------------------+                                     +------------------+
         ^                                                       ^
         |                 Direct P2P Encrypted Media            |
         +=======================================================+
```

### 1. Signaling vs. Media Transport
* **Signaling Server (Socket.IO over WebSocket/TCP)**:
  * The server is responsible **only** for room membership tracking, participant validation, routing SDP offers and answers, exchanging ICE candidates, and broadcasting text chat.
  * **No audio, video, or screen sharing data passes through the server.** This minimizes server bandwidth and latency.
* **Media Transport (WebRTC over UDP/SRTP)**:
  * Once the signaling server helps peers discover each other and negotiate network candidates, direct peer-to-peer `RTCPeerConnection`s are formed.
  * Audio, video, and display media packets travel directly between client browsers, encrypted via DTLS/SRTP.

### 2. Mesh Topology (Full Mesh)
* In NexusMeet, every participant establishes an independent `RTCPeerConnection` with every other participant in the room ($N \times (N-1) / 2$ connections in total).
* For small meetings (up to 4 participants), this architecture eliminates the need for expensive media servers (SFUs/MCUs) while keeping cloud infrastructure costs at zero.

---

## Project Structure

```
Video-Conference-App/
├── package.json                 # Root script runner for concurrent dev execution
├── README.md                    # Project documentation, architecture, and setup guide
├── docs/
│   └── DEMO_GUIDE.md            # 2-minute demo flow, feature checklist, and interview Q&A
├── client/                      # React frontend application
│   ├── .env                     # Local environment variables for client
│   ├── .env.example             # Template for client environment configuration
│   ├── index.html               # Frontend HTML entry point
│   ├── package.json             # Frontend dependencies and Vite build scripts
│   ├── tailwind.config.js       # Tailwind theme colors, gradients, and glow effects
│   ├── vite.config.js           # Vite server and React plugin configuration
│   └── src/
│       ├── main.jsx             # React DOM root render
│       ├── App.jsx              # React Router setup and top-level providers
│       ├── index.css            # Tailwind directives and custom utility classes
│       ├── components/
│       │   └── common/
│       │       ├── Navbar.jsx         # Sticky header with real-time clock & API health status
│       │       ├── NewMeetingModal.jsx# Shareable meeting code modal with copy button
│       │       ├── SettingsModal.jsx  # Audio/video device selectors & live volume meter
│       │       └── Toast.jsx          # Context-driven toast notifications
│       ├── hooks/
│       │   ├── useMediaDevices.js     # Camera/mic capture, release, device switching, volume meter
│       │   ├── useRoomSocket.js       # Socket.IO connection and room membership lifecycle
│       │   ├── useWebRTC.js           # Mesh WebRTC peer connections, negotiation, screen sharing
│       │   └── useRoomChat.js         # Real-time room chat, unread count, 5s timeout safeguard
│       ├── pages/
│       │   ├── HomePage.jsx           # Landing page: start instant meeting or join code
│       │   └── RoomPreviewPage.jsx    # Interactive meeting room: video grid, controls, chat/drawer
│       └── services/
│           └── webrtcConfig.js        # STUN configuration (Google public STUN servers)
└── server/                      # Node.js backend application
    ├── .env                     # Server environment variables
    ├── .env.example             # Template for server environment configuration
    ├── package.json             # Server dependencies and scripts
    └── src/
        ├── server.js            # Express server, Socket.IO initialization, health check
        └── socket/
            ├── index.js         # Socket.IO event handlers for WebRTC signaling and chat
            └── roomManager.js   # In-memory room tracker, 4-user limit, chat history memory
```

---

## Prerequisites

* **Node.js**: `v18.0.0` or higher (v20+ recommended)
* **npm**: `v9.0.0` or higher
* **Web Browser**: Modern Chromium-based browser (Chrome, Edge, Brave) or Firefox with WebRTC support.
* **Hardware**: Webcam and microphone (or virtual capture devices like OBS Virtual Camera).

---

## Installation & Setup

### 1. Clone or Open the Repository
```bash
cd Video-Conference-App
```

### 2. Install Dependencies
Install dependencies for both client and server:

```bash
# Install root orchestration packages
npm install

# Install client packages
cd client
npm install
cd ..

# Install server packages
cd server
npm install
cd ..
```

---

## Environment Variables

### Server Configuration (`server/.env`)
Copy `server/.env.example` to `server/.env`:
```env
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### Client Configuration (`client/.env`)
Copy `client/.env.example` to `client/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
VITE_SOCKET_URL=http://localhost:5001
```

---

## Running the Application

### Option A: Run Concurrently from Root (Recommended)
From the root project directory:
```bash
npm run dev
```

### Option B: Run in Separate Terminals

**Terminal 1 (Backend Server)**:
```bash
cd server
npm run dev
# Starts server on http://localhost:5001 with auto-reload
```

**Terminal 2 (Frontend Client)**:
```bash
cd client
npm run dev
# Starts Vite dev server on http://localhost:5173
```

---

## Development URLs & Endpoints

* **Frontend Web Application**: [http://localhost:5173/](http://localhost:5173/)
* **Backend Signaling Server**: `http://localhost:5001`
* **Backend Health Check**: [http://localhost:5001/api/health](http://localhost:5001/api/health)
  * Returns JSON status:
    ```json
    {
      "status": "ok",
      "service": "NexusMeet Video Conferencing API",
      "phase": "Phase 7 - Reliability Audit & Code Quality",
      "uptime": "120s",
      "timestamp": "2026-10-11T11:00:00.000Z",
      "environment": "development"
    }
    ```

---

## Testing Multi-Participant Calling

To test multi-participant calling on a single machine:

1. **Host Session (User 1)**:
   * Open [http://localhost:5173/](http://localhost:5173/) in your primary browser.
   * Click **New Meeting** -> **Start an instant meeting** (or enter a custom code such as `team-sync`).
   * Allow camera and microphone permissions when prompted.
2. **Participant 2**:
   * Open an **Incognito / Private Window** (or a second browser like Edge or Firefox).
   * Navigate to the meeting URL: `http://localhost:5173/room/team-sync`.
   * Observe the UI adjust into a **2-column grid** with direct P2P audio/video connected.
3. **Participant 3**:
   * Open a third window/tab at `http://localhost:5173/room/team-sync`.
   * Observe the layout transition into a **3-tile grid**.
4. **Participant 4**:
   * Open a fourth window/tab at `http://localhost:5173/room/team-sync`.
   * Observe the layout organize into a balanced **2×2 grid**.
5. **Screen Sharing**:
   * In any participant tab, click the **Share Screen** button.
   * Select a screen or window to broadcast. All other participants immediately see the live screen.
6. **Capacity Limit Test (Participant 5)**:
   * Attempt to join `team-sync` in a 5th window.
   * The join request is rejected with a message: *"Room is at full capacity (maximum 4 participants)."*

---

## Current Architecture Limitations

* **Room Capacity Capped at 4**: Designed strictly as a small-group P2P mesh. Mesh architectures scale at $O(N^2)$ network streams; rooms with larger capacity require an SFU (Selective Forwarding Unit) media server.
* **In-Memory Room State**: Room participant tracking and chat messages are held in Node.js server memory. When all participants leave a room, the room memory and message history are automatically purged.
* **NAT Traversal Configuration**: Configured with standard public Google STUN servers for NAT traversal. TURN servers (relay servers) are not currently configured; connections behind strict symmetric corporate firewalls or carrier-grade NAT may fail to establish direct P2P connections.
* **Guest Authentication**: Users join meetings as authenticated guests with random or assigned nicknames; persistent user accounts and database meeting logs are planned for future phases.

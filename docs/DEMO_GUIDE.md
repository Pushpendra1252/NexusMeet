# NexusMeet — Technical Interview & Demo Guide

This guide is designed for live portfolio walkthroughs and technical architecture interviews. It outlines an efficient demonstration flow, a verified feature checklist, five project-specific interview deep-dives, and detailed explanations of the engineering challenges solved.

---

## 1. Two-Minute Live Demonstration Flow

| Timestamp | Phase | Demonstrator Actions | What the Interviewer Sees |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:30** | **Room Creation & Local Hardware** | 1. Open `http://localhost:5173/` in primary browser.<br>2. Click **New Meeting** -> **Start an instant meeting**.<br>3. Toggle camera off/on. | * Modern dark-mode interface.<br>* Hardware indicator light turns off when camera is disabled (hardware is fully released).<br>* Avatar placeholder with user initials renders smoothly. |
| **0:30 – 1:00** | **1-to-1 WebRTC Connection** | 1. Open private/incognito window at `http://localhost:5173/room/<code-id>`.<br>2. Observe connection establishment. | * Top bar reflects `Signaling Connected` -> `Mesh Live`.<br>* Video canvas adapts from single tile to **2-column grid**.<br>* Encrypted direct peer-to-peer media flows between windows. |
| **1:00 – 1:30** | **Multi-Participant Mesh & Grid** | 1. Open 3rd and 4th browser windows to the same URL.<br>2. Open the **In-Call Chat** drawer in window 1 and window 2.<br>3. Send a message. | * Canvas dynamically rebalances to 3 tiles, then to a **balanced 2×2 grid**.<br>* Top bar updates to `Mesh Live (3/3)` and `4/4 in meeting`.<br>* Chat delivers in real-time with verified room isolation and unread badges. |
| **1:30 – 2:00** | **Screen Sharing & Capacity Guard** | 1. Click **Screen Share** on User 1.<br>2. Stop sharing using the browser's native bar.<br>3. Attempt to join with a 5th tab. | * Video tile hot-swaps camera feed with desktop stream on all 3 peers without connection drop.<br>* Stopping screen share restores original camera state.<br>* 5th tab is rejected with an informative capacity overlay. |

---

## 2. Feature Demonstration Checklist

* [ ] **Instant Room Creation**: Generates clean meeting URLs (`/room/nex-xxx-xxx`).
* [ ] **Local Hardware Lifecycle**: Camera track actually stops and releases physical webcam sensor.
* [ ] **Independent Audio Muting**: Muting microphone disables audio transmission while keeping video intact.
* [ ] **Real-Time Web Audio Meter**: Live volume level meter in Settings modal responds dynamically to voice input.
* [ ] **Socket.IO Room Signaling**: Real participant counts, join/leave broadcasts, and clean disconnections.
* [ ] **Mesh WebRTC (Up to 4 Peers)**: Direct encrypted P2P audio/video with independent `RTCPeerConnection`s.
* [ ] **W3C Perfect Negotiation**: Polite vs impolite peer arbitration prevents offer glare.
* [ ] **Adaptive Video Canvas**: Automatically transitions through 1-tile, 2-column, 3-column, and 2×2 grid layouts.
* [ ] **Screen Sharing Hot-Swapping**: Swaps outbound video track via `replaceTrack` without renegotiation or dropped calls.
* [ ] **Native Stop-Sharing Recovery**: Automatically restores previous camera state when user clicks browser's native "Stop sharing".
* [ ] **In-Meeting Chat**: Real-time room messaging with server validation (1–1,000 characters) and 50-message buffer.
* [ ] **Room Capacity Enforcement**: Rejects 5th user with an informative "Unable to Join" overlay.
* [ ] **Teardown & Cleanup**: Closing a tab releases media tracks and disposes peer connections without disrupting other participants.

---

## 3. Five Technical Interview Questions & Project-Specific Answers

### Q1: How does WebRTC connection establishment work in NexusMeet, and why is a signaling server needed?
**Answer Outline**:
* **The Problem WebRTC Solves**: WebRTC enables direct peer-to-peer audio, video, and data transmission between browsers. However, browsers behind NATs and firewalls cannot automatically discover each other's IP addresses, port mappings, or supported media codecs.
* **Why Signaling is Essential**: Browsers need an out-of-band communication channel (the "Signaling Server") before they can establish a direct connection. NexusMeet uses **Socket.IO over WebSocket** as this channel.
* **The 4-Step Negotiation Process**:
  1. **Offer Generation**: Peer A adds local audio/video tracks to `RTCPeerConnection`, creates an SDP offer (`createOffer`/`setLocalDescription`), and emits `webrtc-offer` via Socket.IO.
  2. **Offer Consumption & Answer**: The server routes the offer to Peer B. Peer B sets `setRemoteDescription`, creates an SDP answer (`createAnswer`/`setLocalDescription`), and emits `webrtc-answer`.
  3. **Answer Consumption**: Peer A receives the answer and sets `setRemoteDescription`.
  4. **ICE Candidate Exchange**: Concurrently, both peers query Google STUN servers (`stun:stun.l.google.com:19302`) to discover their public-facing IP and port candidates (`pc.onicecandidate`), exchanging them over Socket.IO via `webrtc-ice-candidate` to establish the optimal P2P UDP path.

---

### Q2: How does the multi-participant mesh architecture work, and what are its trade-offs vs SFU / MCU?
**Answer Outline**:
* **Mesh Architecture in NexusMeet**:
  * Each participant maintains an independent `RTCPeerConnection` with every other participant in the room. For 4 participants, there are $4 \times 3 / 2 = 6$ total connections.
  * Every client encodes and uploads their audio/video stream to $N-1$ remote peers directly.
* **Trade-Off Analysis**:
  * **Mesh (NexusMeet)**:
    * *Pros*: Zero server bandwidth costs, end-to-end encryption without trusting a middlebox, minimal infrastructure complexity.
    * *Cons*: Client upload bandwidth and CPU scale with $O(N)$. At 4 participants (3 outbound streams), modern consumer devices handle this easily. Above 4–5 participants, uplink saturation degrades performance.
  * **SFU (Selective Forwarding Unit)**:
    * Clients send 1 upstream to a server; the server forwards streams to all other peers. Scales to 50–100 participants, but requires media server infrastructure (e.g. Mediasoup, LiveKit).
  * **MCU (Multipoint Control Unit)**:
    * Server decodes, composites, and re-encodes all video into 1 combined feed. High server CPU cost and added latency; rarely used in modern web systems.
* **Design Decision**: A 4-participant capped mesh was selected to deliver a pure, serverless-media P2P application with zero cloud media costs.

---

### Q3: How did you resolve offer collisions (glare) in the peer-to-peer mesh?
**Answer Outline**:
* **The Problem (Glare)**: In a mesh network, when two peers simultaneously add tracks or initiate negotiation, both may generate and send an SDP offer while their signaling state is not `stable`. If unhandled, both peers reject the incoming offer, causing a deadlock.
* **NexusMeet's Solution (W3C Perfect Negotiation)**:
  * NexusMeet implements deterministic politeness based on unique socket IDs:
    ```javascript
    const isPolite = selfSocketId < remoteSocketId;
    ```
  * When an offer arrives:
    * **Collision Check**: If `peerEntry.makingOffer || pc.signalingState !== 'stable'`, collision has occurred.
    * **Impolite Peer**: Rejects the incoming offer (`ignoreOffer = true`) and proceeds with its own offer.
    * **Polite Peer**: Yields gracefully, rolls back its local offer (`await pc.setLocalDescription({ type: 'rollback' })`), accepts the remote offer, and returns an answer.
  * This guarantees that for every peer pair $(A, B)$, exactly one peer yields and negotiation always stabilizes without manual retries.

---

### Q4: How does track hot-swapping work during screen sharing without dropping the call, and how did you prevent "Track kind does not match Sender Kind" errors?
**Answer Outline**:
* **Mechanism**:
  * NexusMeet uses `RTCRtpSender.replaceTrack()` rather than renegotiating the session (`addTrack`/`removeTrack`).
  * `replaceTrack()` substitutes the outbound media source directly inside the existing RTP video pipeline without requiring SDP renegotiation.
* **The Bug Encountered**:
  * Browsers throw: `Failed to execute 'replaceTrack' on 'RTCRtpSender': Track kind does not match Sender Kind` when passing a video track to an audio sender.
  * When a video sender's track is `null` (e.g., user started meeting with camera turned off), standard `sender.track.kind` returns `undefined`. Naive code that iterates over `pc.getSenders()` could match the audio sender and attempt to replace it with the screen share track.
* **The Fix (`getVideoSender` & `safeReplaceTrack`)**:
  1. Inspect the sender's corresponding `RTCRtpTransceiver.receiver.track.kind`, which is **immutable** ('video' or 'audio') even when `sender.track` is `null`.
  2. Cache the resolved `videoSender` and `audioSender` on the peer entry.
  3. Wrap every track substitution in `safeReplaceTrack()`, which validates `senderKind === expectedKind && track.kind === expectedKind` prior to invoking the native API.

---

### Q5: How are hardware lifecycle and microphone/camera resources managed to prevent memory leaks and zombie webcam capture?
**Answer Outline**:
* **Webcam Capture vs. Track Disabling**:
  * Simply setting `track.enabled = false` silences the stream but **keeps the hardware device active** (the physical webcam light remains on, consuming power and privacy).
  * NexusMeet implements true hardware release: when the camera is toggled off, `track.stop()` is called on the video track and it is removed from the active `MediaStream`. The physical indicator light turns off.
  * When toggled back on, `getUserMedia` re-acquires a fresh hardware stream and hot-swaps it across all mesh peer senders via `replaceTrack()`.
* **Microphone Independence**:
  * Microphone muting toggles `audioTrack.enabled` without stopping the track, preserving the audio hardware session and eliminating latency when unmuting.
* **Memory & Event Teardown**:
  * On room departure or browser tab close (`beforeunload`), `stopAllTracks()` iterates through all tracks, calls `track.stop()`, cancels active `requestAnimationFrame` loops, and closes the `AudioContext`.
  * For each remote peer, all event callbacks (`onicecandidate`, `ontrack`, `onconnectionstatechange`) are nulled out before calling `pc.close()`, preventing ghost callbacks during garbage collection.

---

## 4. Key Engineering Challenges Solved

### 1. The `replaceTrack` Kind Mismatch Bug
* **Challenge**: When a participant shared their screen after starting a meeting with their camera off, `replaceTrack()` crashed with `Track kind does not match Sender Kind`.
* **Root Cause**: `RTCRtpSender.track` is `null` when camera is off. Standard sender lookups checked `sender.track.kind`, failing to locate the video sender and accidentally picking an audio sender.
* **Resolution**: Implemented transceiver-level kind inspection via `transceiver.receiver.track.kind` which permanently exposes the media kind even when the sender's track is null.

### 2. Full-Mesh W3C Perfect Negotiation & Listener Stability
* **Challenge**: In a 4-user mesh, participants toggling their camera or microphone caused React state updates that re-created `createPeerConnection`, forcing signaling listeners to detach and re-attach, intermittently dropping in-flight SDP offers.
* **Resolution**: Decoupled peer creation from React render state using synchronized mutable refs (`localStreamRef`, `isVideoOnRef`, `isMicOnRef`). Event listeners attach stably on mount and never tear down during hardware toggles.

### 3. Early ICE Candidate Discarding
* **Challenge**: Due to network timing, ICE candidate packets frequently arrived at a remote peer before the corresponding SDP offer had been processed, resulting in lost candidates and failed connections.
* **Resolution**: Implemented a per-peer candidate buffer (`candidateQueue`). Incoming candidates arriving before `setRemoteDescription` are buffered and automatically flushed once the remote description is applied.

### 4. AudioContext Loop Leaks
* **Challenge**: Repeated switching between audio input devices spawned multiple concurrent `requestAnimationFrame` measurement loops in the Web Audio API analyser, causing CPU spikes.
* **Resolution**: Added cancellation guards that explicitly call `cancelAnimationFrame()` and dispose obsolete `AudioContext` instances prior to creating new measurement nodes.

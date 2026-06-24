/**
 * VideoRoom.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full WebRTC peer-to-peer video call room.
 *
 * Props
 * ─────
 *  appointmentId  – used as the Socket.IO room name ("room:<appointmentId>")
 *  socket         – the shared socket.io-client Socket instance from your app
 *  localUserName  – display name for the local tile label
 *  remoteUserName – display name for the remote tile label
 *  isCaller       – true for the doctor (creates & sends the offer)
 *                   false for the patient (waits for the offer)
 *  onClose        – callback when the user ends / the remote peer hangs up
 *
 * Signalling flow
 * ───────────────
 *  Doctor  (isCaller=true)
 *    1. getUserMedia → join room → wait for 'peer-joined' → createOffer
 *    2. setLocalDescription → emit 'send-offer' → wait for 'receive-answer'
 *    3. setRemoteDescription → trickle ICE via 'ice-candidate'
 *
 *  Patient (isCaller=false)
 *    1. getUserMedia → join room → wait for 'receive-offer'
 *    2. setRemoteDescription → createAnswer → setLocalDescription
 *    3. emit 'make-answer' → trickle ICE via 'ice-candidate'
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";

// ── Lucide icons (already installed in this project) ──────────────────────────
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Maximize2, Minimize2, AlertTriangle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// STUN configuration
// ─────────────────────────────────────────────────────────────────────────────
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface VideoRoomCloseDetails {
  wasConnected: boolean;
  durationSeconds: number;
  closedBy: "local" | "remote";
}

interface VideoRoomProps {
  appointmentId: string;
  socket: Socket;
  localUserName: string;
  remoteUserName: string;
  isCaller: boolean;
  onClose: (details?: VideoRoomCloseDetails) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function VideoRoom({
  appointmentId,
  socket,
  localUserName,
  remoteUserName,
  isCaller,
  onClose,
}: VideoRoomProps) {
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const offerStartedRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const callDurationRef = useRef(0);

  const [micOn,       setMicOn]       = useState(true);
  const [camOn,       setCamOn]       = useState(true);
  const [connected,   setConnected]   = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fullscreen,  setFullscreen]  = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const roomId = appointmentId;

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => {
      setCallDuration((seconds) => {
        const next = seconds + 1;
        callDurationRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [connected]);

  const closeCall = useCallback((closedBy: VideoRoomCloseDetails["closedBy"]) => {
    onClose({
      wasConnected: hasConnectedRef.current,
      durationSeconds: callDurationRef.current,
      closedBy,
    });
  }, [onClose]);

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Create RTCPeerConnection ───────────────────────────────────────────────
  const createPC = useCallback((stream: MediaStream): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local tracks to the connection
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // When we receive remote tracks, attach them to the remote <video>
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      hasConnectedRef.current = true;
      setRemoteReady(true);
      setConnected(true);
    };

    // Trickle ICE: send candidates to the server as they are discovered
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { roomId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        setConnected(false);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket, roomId]);

  // ── Main setup effect ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let handlePeerJoined: (() => void) | null = null;
    let handleReceiveOffer: ((payload: { sdp: RTCSessionDescriptionInit }) => void) | null = null;
    let handleReceiveAnswer: ((payload: { sdp: RTCSessionDescriptionInit }) => void) | null = null;
    let handleIceCandidate: ((payload: { candidate: RTCIceCandidateInit }) => void) | null = null;
    let handleCallEnded: (() => void) | null = null;

    const setup = async () => {
      if (!roomId) {
        setError("Missing appointment room. Please close this call and try again.");
        return;
      }

      // 1. Acquire camera + microphone
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setError(
          "Camera or microphone access was denied. " +
          "Please allow access in your browser settings and reload."
        );
        return;
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Create peer connection
      const pc = createPC(stream);

      const flushPendingCandidates = async () => {
        if (!pc.remoteDescription?.type || pendingCandidatesRef.current.length === 0) return;

        const queuedCandidates = [...pendingCandidatesRef.current];
        pendingCandidatesRef.current = [];

        for (const candidate of queuedCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("addIceCandidate error:", e);
          }
        }
      };

      const addRemoteCandidate = async (candidate: RTCIceCandidateInit) => {
        if (!candidate) return;

        if (!pc.remoteDescription?.type) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }

        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("addIceCandidate error:", e);
        }
      };

      const createAndSendOffer = async () => {
        if (cancelled || offerStartedRef.current || pc.signalingState !== "stable") return;

        offerStartedRef.current = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("send-offer", { roomId, sdp: pc.localDescription });
        } catch (e) {
          offerStartedRef.current = false;
          setError("Failed to create call offer. Please try again.");
          console.error("Offer error:", e);
        }
      };

      // ── Caller side (Doctor) ────────────────────────────────────────────
      if (isCaller) {
        // Wait for the patient to also join the room, then send the offer
        handlePeerJoined = () => {
          void createAndSendOffer();
        };
        socket.on("peer-joined", handlePeerJoined);
      }

      // ── Callee side (Patient) ───────────────────────────────────────────
      // Receives the offer that the doctor already sent (or will send soon)
      handleReceiveOffer = async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        if (cancelled || isCaller) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushPendingCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("make-answer", { roomId, sdp: pc.localDescription });
        } catch (e) {
          setError("Failed to answer the call. Please try again.");
          console.error("Answer error:", e);
        }
      };
      socket.on("receive-offer", handleReceiveOffer);

      // ── Caller receives the answer ──────────────────────────────────────
      handleReceiveAnswer = async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        if (cancelled || !isCaller) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushPendingCandidates();
        } catch (e) {
          console.error("setRemoteDescription (answer) error:", e);
        }
      };
      socket.on("receive-answer", handleReceiveAnswer);

      // ── Trickle ICE candidates ──────────────────────────────────────────
      handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        if (cancelled || !candidate) return;
        await addRemoteCandidate(candidate);
      };
      socket.on("ice-candidate", handleIceCandidate);

      // ── Remote peer hung up ─────────────────────────────────────────────
      handleCallEnded = () => {
        if (!cancelled) closeCall("remote");
      };
      socket.on("call-ended", handleCallEnded);

      // Join after handlers are registered so fast answers and ICE are not missed.
      socket.emit(
        "join-room",
        { roomId },
        (response?: { ok?: boolean; error?: string; peerCount?: number }) => {
          if (cancelled) return;

          if (!response?.ok) {
            setError(response?.error || "Could not join the call room. Please try again.");
            return;
          }

          if (isCaller && (response.peerCount ?? 0) > 0) {
            void createAndSendOffer();
          }
        }
      );
    };

    setup();

    return () => {
      cancelled = true;
      // Clean up socket listeners scoped to this call
      if (handleReceiveOffer) socket.off("receive-offer", handleReceiveOffer);
      if (handleReceiveAnswer) socket.off("receive-answer", handleReceiveAnswer);
      if (handleIceCandidate) socket.off("ice-candidate", handleIceCandidate);
      if (handleCallEnded) socket.off("call-ended", handleCallEnded);
      if (handlePeerJoined) socket.off("peer-joined", handlePeerJoined);
      pendingCandidatesRef.current = [];
      offerStartedRef.current = false;
      // Stop all local media tracks
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      // Close the peer connection
      pcRef.current?.close();
      pcRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Controls ───────────────────────────────────────────────────────────────
  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setCamOn(videoTrack.enabled);
  };

  const hangUp = () => {
    socket.emit("hang-up", { roomId });
    closeCall("local");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "#070d1a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
      }}
    >
      {/* ── Top bar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: connected ? "#00D9B5" : "#FFB547",
              boxShadow: connected ? "0 0 8px #00D9B5" : "0 0 8px #FFB547",
              animation: "pulse-dot 1.8s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>
              {connected ? "LIVE" : "CONNECTING…"}
            </span>
          </div>
          {connected && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>
              {fmtDuration(callDuration)}
            </span>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "#fff", margin: 0 }}>
            Telehealth Session
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Room · {appointmentId.slice(-8).toUpperCase()}
          </p>
        </div>

        <button
          onClick={() => setFullscreen(f => !f)}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "6px 10px",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
          }}
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div style={{
          margin: "20px 24px 0",
          background: "rgba(255,77,109,0.12)",
          border: "1px solid rgba(255,77,109,0.35)",
          borderRadius: 12,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#FF4D6D",
          fontSize: 14,
          flexShrink: 0,
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Video area ── */}
      <div style={{
        flex: 1,
        position: "relative",
        display: "grid",
        gridTemplateColumns: remoteReady ? "1fr 1fr" : "1fr",
        gap: 12,
        padding: 16,
        overflow: "hidden",
      }}>

        {/* Remote video (full-size when alone, half when local is beside it) */}
        <div style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: remoteReady ? "block" : "none",
              transform: "scaleX(-1)", // mirror
            }}
          />
          {!remoteReady && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              color: "rgba(255,255,255,0.5)",
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(135deg,#0aa87e,#3D9EFF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 700,
                color: "#fff",
              }}>
                {remoteUserName.slice(0, 2).toUpperCase()}
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{remoteUserName}</p>
              <p style={{ fontSize: 12 }}>
                {isCaller ? "Waiting for patient to join…" : "Connecting to doctor…"}
              </p>
              {/* Animated dots */}
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#00D9B5",
                    animation: `bounce-dot 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          {/* Name label */}
          <span style={{
            position: "absolute",
            bottom: 12,
            left: 14,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
          }}>
            {remoteUserName}
          </span>
        </div>

        {/* Local video */}
        <div style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          background: "#0d1526",
          border: "1px solid rgba(0,217,181,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted // always mute local to avoid echo
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: camOn ? "block" : "none",
              transform: "scaleX(-1)",
            }}
          />
          {!camOn && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              color: "rgba(255,255,255,0.4)",
            }}>
              <VideoOff size={36} />
              <p style={{ fontSize: 12 }}>Camera off</p>
            </div>
          )}
          {/* Name label */}
          <span style={{
            position: "absolute",
            bottom: 12,
            left: 14,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
          }}>
            {localUserName} (You)
          </span>
          {/* Muted badge */}
          {!micOn && (
            <span style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "rgba(255,77,109,0.85)",
              borderRadius: 8,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              <MicOff size={11} /> Muted
            </span>
          )}
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "20px 24px",
        background: "rgba(255,255,255,0.03)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <ControlBtn
          onClick={toggleMic}
          active={micOn}
          icon={micOn ? <Mic size={20} /> : <MicOff size={20} />}
          label={micOn ? "Mute" : "Unmute"}
        />
        <ControlBtn
          onClick={toggleCam}
          active={camOn}
          icon={camOn ? <Video size={20} /> : <VideoOff size={20} />}
          label={camOn ? "Stop Video" : "Start Video"}
        />
        {/* End call */}
        <button
          onClick={hangUp}
          title="End Call"
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: "none",
            background: "#FF4D6D",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            boxShadow: "0 4px 20px rgba(255,77,109,0.45)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          <PhoneOff size={22} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>END</span>
        </button>
      </div>

      {/* ── Inline keyframes ── */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes bounce-dot {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-7px); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable control button
// ─────────────────────────────────────────────────────────────────────────────
interface ControlBtnProps {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}

function ControlBtn({ onClick, active, icon, label }: ControlBtnProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        border: `1px solid ${active ? "rgba(255,255,255,0.15)" : "rgba(255,77,109,0.4)"}`,
        background: active ? "rgba(255,255,255,0.08)" : "rgba(255,77,109,0.15)",
        color: active ? "#fff" : "#FF4D6D",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.2s, border-color 0.2s, transform 0.15s",
      }}
      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
    >
      {icon}
    </button>
  );
}

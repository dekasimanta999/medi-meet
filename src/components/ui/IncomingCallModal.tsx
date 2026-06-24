/**
 * IncomingCallModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global modal that listens for the 'incoming-call' Socket.IO event and lets
 * the patient accept or decline the call.
 *
 * Mount this ONCE near the root of your patient-facing app (e.g. inside App.tsx
 * or a patient layout component) so it is always listening regardless of which
 * page the patient is on.
 *
 * Usage
 * ─────
 *   import { IncomingCallModal } from "./IncomingCallModal";
 *   import { socket } from "../socket";           // your shared socket instance
 *
 *   // Inside the patient's root component:
 *   const userInfo = JSON.parse(sessionStorage.getItem("userInfo") || "{}");
 *
 *   <IncomingCallModal
 *     socket={socket}
 *     localUserId={userInfo._id}
 *     localUserName={userInfo.name}
 *   />
 */

import { useEffect, useState, useRef } from "react";
import type { Socket } from "socket.io-client";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { VideoRoom } from "./VideoRoom";

const PATIENT_RINGTONE_SRC = "/sounds/patient-ringtone.mp3";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface IncomingCallPayload {
  appointmentId: string;
  callerName: string;
  callerSocketId: string;
}

interface IncomingCallModalProps {
  socket: Socket;
  localUserId: string;
  localUserName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function IncomingCallModal({
  socket,
  localUserId,
  localUserName,
}: IncomingCallModalProps) {
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [inCall, setInCall] = useState(false);
  const [visible, setVisible] = useState(false); // controls CSS entrance animation
  const ringRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Stable ref so VideoRoom always has the appointmentId even after
  // incomingCall state is cleared when the patient clicks Accept.
  const activeCallRef = useRef<IncomingCallPayload | null>(null);

  // ── Register with the server using the patient's userId ───────────────────
  // The server uses this to route 'incoming-call' to the right socket.
  useEffect(() => {
    if (localUserId) {
      // Re-emit on reconnect as well
      socket.auth = { ...(socket.auth as object), userId: localUserId };
      socket.emit("join-room", { roomId: `user:${localUserId}` }); // optional extra room
    }
  }, [socket, localUserId]);

  // ── Listen for incoming calls ─────────────────────────────────────────────
  useEffect(() => {
    const handleIncoming = (payload: IncomingCallPayload) => {
      stopRingtone();
      activeCallRef.current = payload;
      setIncomingCall(payload);
      setVisible(false);
      // Slight delay so the CSS animation fires after mount
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));

      // Auto-decline after 30 seconds if ignored
      ringRef.current = setTimeout(() => {
        stopRingtone();
        setIncomingCall(null);
        setVisible(false);
      }, 30_000);

      // Play a ringtone if the browser allows it
      try {
        const audio = new Audio(PATIENT_RINGTONE_SRC);
        audio.loop = true;
        audio.preload = "auto";
        audio.volume = 0.6;
        audio.play().catch(() => {/* autoplay blocked — silent failure is fine */});
        audioRef.current = audio;
      } catch { /* ignore */ }
    };

    socket.on("incoming-call", handleIncoming);
    return () => {
      socket.off("incoming-call", handleIncoming);
      stopRingtone();
    };
  }, [socket]);

  const stopRingtone = () => {
    if (ringRef.current) clearTimeout(ringRef.current);
    ringRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  const handleAccept = () => {
    stopRingtone();
    // Keep activeCallRef intact — VideoRoom reads appointmentId from it.
    setIncomingCall(null);
    setVisible(false);
    setInCall(true);
  };

  const handleDecline = () => {
    stopRingtone();
    setIncomingCall(null);
    setVisible(false);
    // Inform the caller so their UI can react
    if (incomingCall) {
      socket.emit("hang-up", { roomId: incomingCall.appointmentId });
    }
  };

  const handleCallEnd = () => {
    setInCall(false);
  };

  // ── Nothing to render ─────────────────────────────────────────────────────
  if (!incomingCall && !inCall) return null;

  // ── Active call: hand off to VideoRoom ────────────────────────────────────
  return (
    <>
      {/* ── Incoming call notification ── */}
      {incomingCall && !inCall && (
        <>
          {/* Backdrop */}
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(7,9,26,0.75)",
            backdropFilter: "blur(8px)",
            zIndex: 3000,
            transition: "opacity 0.35s",
            opacity: visible ? 1 : 0,
          }} />

          {/* Card */}
          <div style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: visible
              ? "translate(-50%,-50%) scale(1)"
              : "translate(-50%,-46%) scale(0.94)",
            zIndex: 3001,
            width: "min(420px, calc(100vw - 40px))",
            background: "linear-gradient(145deg,#0d1526 0%,#101e38 100%)",
            border: "1px solid rgba(0,217,181,0.25)",
            borderRadius: 24,
            padding: "36px 32px 28px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,217,181,0.15) inset",
            textAlign: "center",
            transition: "transform 0.38s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s",
            opacity: visible ? 1 : 0,
            fontFamily: "'DM Sans','Segoe UI',sans-serif",
          }}>
            {/* Dismiss */}
            <button
              onClick={handleDecline}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: "rgba(255,255,255,0.06)",
                border: "none",
                borderRadius: 8,
                padding: 6,
                color: "rgba(255,255,255,0.45)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <X size={16} />
            </button>

            {/* Animated avatar ring */}
            <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
              <div style={{
                position: "absolute",
                inset: -10,
                borderRadius: "50%",
                border: "2px solid rgba(0,217,181,0.3)",
                animation: "ring-pulse 1.8s ease-in-out infinite",
              }} />
              <div style={{
                position: "absolute",
                inset: -20,
                borderRadius: "50%",
                border: "2px solid rgba(0,217,181,0.15)",
                animation: "ring-pulse 1.8s 0.4s ease-in-out infinite",
              }} />
              <div style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#0aa87e,#3D9EFF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 700,
                color: "#fff",
                position: "relative",
                zIndex: 1,
              }}>
                {incomingCall.callerName.slice(0, 2).toUpperCase()}
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: "#00D9B5", letterSpacing: "0.1em", marginBottom: 6 }}>
              INCOMING VIDEO CALL
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              {incomingCall.callerName}
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 32 }}>
              MediMeet Telehealth Session
            </p>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              {/* Decline */}
              <button
                onClick={handleDecline}
                style={{
                  flex: 1,
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "1px solid rgba(255,77,109,0.35)",
                  background: "rgba(255,77,109,0.12)",
                  color: "#FF4D6D",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background 0.2s",
                }}
                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,77,109,0.22)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,77,109,0.12)"; }}
              >
                <PhoneOff size={17} /> Decline
              </button>

              {/* Accept */}
              <button
                onClick={handleAccept}
                style={{
                  flex: 1,
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg,#0aa87e,#3D9EFF)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 6px 24px rgba(10,168,126,0.4)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
              >
                <Phone size={17} /> Accept
              </button>
            </div>

            {/* Auto-decline countdown bar */}
            <div style={{
              marginTop: 22,
              height: 3,
              borderRadius: 2,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: "100%",
                background: "linear-gradient(90deg,#00D9B5,#3D9EFF)",
                transformOrigin: "left",
                animation: "shrink-bar 30s linear forwards",
              }} />
            </div>
          </div>

          <style>{`
            @keyframes ring-pulse {
              0%   { transform: scale(1);   opacity: 1;   }
              100% { transform: scale(1.6); opacity: 0;   }
            }
            @keyframes shrink-bar {
              from { transform: scaleX(1); }
              to   { transform: scaleX(0); }
            }
          `}</style>
        </>
      )}

      {/* ── Active VideoRoom (mounted after Accept) ── */}
      {inCall && (
        <VideoRoom
          appointmentId={activeCallRef.current?.appointmentId ?? ""}
          socket={socket}
          localUserName={localUserName}
          remoteUserName={activeCallRef.current?.callerName ?? "Doctor"}
          isCaller={false}         // patient is always the callee
          onClose={handleCallEnd}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The activeCallRef holds the last received call payload so that VideoRoom
// always gets the appointmentId even after the incomingCall state is cleared
// when the patient clicks Accept.
// ─────────────────────────────────────────────────────────────────────────────

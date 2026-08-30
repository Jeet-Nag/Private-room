"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { RoomProvider, useRoom } from "../../../lib/store/roomStore";
import { RoomLayout } from "../../../components/room/RoomLayout";
import { JoinRoomModal } from "../../../components/landing/JoinRoomModal";

function RoomContent({ roomCode }: { roomCode: string }) {
  const params = useParams();
  const router = useRouter();
  const { room, joinRoomSession } = useRoom();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const code = (params?.code as string) || roomCode;
    if (!code) return;

    // Check if user already has an active session for a room with this code
    let foundSession = false;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("phantom_session_")) {
        try {
          const sessionData = JSON.parse(sessionStorage.getItem(key) || "{}");
          if (sessionData.room?.code === code || sessionData.room?.id === code) {
            joinRoomSession(sessionData.room.id, sessionData.participant, sessionData.sessionToken);
            foundSession = true;
            break;
          }
        } catch {
          // ignore corrupted storage
        }
      }
    }

    if (!foundSession) {
      setIsJoinModalOpen(true);
    }
    setIsCheckingSession(false);
  }, [params?.code, roomCode, joinRoomSession]);

  const handleJoinSuccess = (data: { room: any; participant: any; sessionToken: string }) => {
    sessionStorage.setItem(`phantom_session_${data.room.id}`, JSON.stringify(data));
    sessionStorage.setItem(`phantom_token_${data.room.id}`, data.sessionToken);
    joinRoomSession(data.room.id, data.participant, data.sessionToken);
    setIsJoinModalOpen(false);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-background text-slate-100 flex items-center justify-center font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-phantom-cyan border-t-transparent rounded-full animate-spin" />
          <span>INITIALIZING SECURE SESSION...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <RoomLayout />
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        initialCode={params?.code as string}
        onClose={() => router.push("/")}
        onJoinSuccess={handleJoinSuccess}
      />
    </>
  );
}

export default function RoomPage() {
  const params = useParams();
  const roomCode = (params?.code as string) || "";

  return (
    <RoomProvider>
      <RoomContent roomCode={roomCode} />
    </RoomProvider>
  );
}

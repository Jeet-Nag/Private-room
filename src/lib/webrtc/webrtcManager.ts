import { Socket } from "socket.io-client";
import { SignalPayload } from "../../../server/types";

const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.nextcloud.com:443" },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private candidateTypes: Map<string, Set<string>> = new Map();
  private rtcConfig: RTCConfiguration = DEFAULT_ICE_SERVERS;

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  private onRemoteStreamCallback: ((participantId: string, stream: MediaStream, kind: "camera" | "screen") => void) | null = null;
  private onRemoteStreamRemovedCallback: ((participantId: string, kind: "camera" | "screen") => void) | null = null;
  private onSpeakingCallback: ((isSpeaking: boolean, level: number) => void) | null = null;
  private onScreenShareEndedCallback: (() => void) | null = null;
  private onDiagnosticEventCallback: ((event: { source: string; code: string; message: string; severity?: "info" | "warning" | "error" }) => void) | null = null;
  private animationFrameId: number | null = null;

  public setOnRemoteStream(cb: (participantId: string, stream: MediaStream, kind: "camera" | "screen") => void) {
    this.onRemoteStreamCallback = cb;
  }

  public setOnRemoteStreamRemoved(cb: (participantId: string, kind: "camera" | "screen") => void) {
    this.onRemoteStreamRemovedCallback = cb;
  }

  public setOnSpeaking(cb: (isSpeaking: boolean, level: number) => void) {
    this.onSpeakingCallback = cb;
  }

  public setOnScreenShareEnded(cb: () => void) {
    this.onScreenShareEndedCallback = cb;
  }

  public setOnDiagnosticEvent(cb: (event: { source: string; code: string; message: string; severity?: "info" | "warning" | "error" }) => void) {
    this.onDiagnosticEventCallback = cb;
  }

  public async fetchIceServers(): Promise<void> {
    try {
      const res = await fetch("/api/ice-servers");
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          this.rtcConfig = {
            ...this.rtcConfig,
            iceServers: data.iceServers,
          };
          console.log(`[RTC] Loaded ${data.iceServers.length} ICE servers (STUN/TURN)`);
        }
      }
    } catch {
      // Fallback to default STUN servers if fetch fails
      console.warn("[RTC] Using default STUN servers configuration");
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(participantId: string): MediaStream | undefined {
    return this.remoteStreams.get(participantId);
  }

  /**
   * Acquire local camera & microphone
   */
  public async getLocalMedia(audio: boolean = true, video: boolean = true): Promise<MediaStream | null> {
    try {
      console.log(`[MEDIA] getUserMedia requested with audio=${audio} video=${video}`);
      
      if (this.localStream) {
        const hasAudio = this.localStream.getAudioTracks().length > 0;
        const hasVideo = this.localStream.getVideoTracks().length > 0;
        if ((!audio || hasAudio) && (!video || hasVideo)) {
          this.localStream.getAudioTracks().forEach((t) => (t.enabled = audio));
          this.localStream.getVideoTracks().forEach((t) => (t.enabled = video));
          return this.localStream;
        }
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia is not supported on this device/browser context (HTTPS required).");
      }

      let stream: MediaStream | null = null;

      // Tier 1: Try optimal desktop constraints
      try {
        const videoConstraints = video
          ? { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }
          : false;
        const audioConstraints = audio
          ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : false;

        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });
      } catch (err1: any) {
        console.warn("[MEDIA] Optimal constraints failed (", err1.name, err1.message, "). Retrying with basic constraints...");

        // Tier 2: Try basic unconstrained video + audio
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: video ? true : false,
            audio: audio ? true : false,
          });
        } catch (err2: any) {
          console.warn("[MEDIA] Combined basic getUserMedia failed (", err2.name, err2.message, "). Trying separate track acquisition...");

          // Tier 3: Try separate video and audio acquisition (handles case where 1 device is in-use by another app)
          const acquiredTracks: MediaStreamTrack[] = [];

          if (video) {
            try {
              const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
              acquiredTracks.push(...vStream.getVideoTracks());
              console.log("[MEDIA] Isolated video track acquired successfully.");
            } catch (vErr: any) {
              console.warn("[MEDIA] Isolated video track failed:", vErr.name, vErr.message);
            }
          }

          if (audio) {
            try {
              const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              acquiredTracks.push(...aStream.getAudioTracks());
              console.log("[MEDIA] Isolated audio track acquired successfully.");
            } catch (aErr: any) {
              console.warn("[MEDIA] Isolated audio track failed:", aErr.name, aErr.message);
            }
          }

          if (acquiredTracks.length > 0) {
            stream = new MediaStream(acquiredTracks);
          } else {
            // Re-throw original or most specific error
            throw err2 || err1;
          }
        }
      }

      this.localStream = stream;
      stream.getAudioTracks().forEach((t) => (t.enabled = audio));
      stream.getVideoTracks().forEach((t) => (t.enabled = video));

      console.log(`[MEDIA] camera track acquired: ${stream.getVideoTracks().length}`);
      console.log(`[MEDIA] microphone track acquired: ${stream.getAudioTracks().length}`);

      this.initAudioAnalyser(stream);

      // Attach tracks to senders in all existing peer connections
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      this.peers.forEach(async (peer, targetId) => {
        const transceivers = peer.getTransceivers();
        
        const audioTrans = transceivers.find((t) => t.receiver.track.kind === "audio" || t.sender.track?.kind === "audio");
        if (audioTrans && audioTrack) {
          await audioTrans.sender.replaceTrack(audioTrack);
          console.log(`[RTC] local audio track attached to peer ${targetId}`);
        }

        const videoTrans = transceivers.find((t) => t.receiver.track.kind === "video" || t.sender.track?.kind === "video");
        if (videoTrans && videoTrack) {
          await videoTrans.sender.replaceTrack(videoTrack);
          console.log(`[RTC] local video track attached to peer ${targetId}`);
        }
      });

      return stream;
    } catch (err: any) {
      console.error(`[MEDIA ERROR] ${err.name}: ${err.message}`, err);

      let code = "MEDIA_ERROR";
      let userFriendlyMsg = err.message || "Failed to acquire camera/microphone.";

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        code = "PERMISSION_DENIED";
        userFriendlyMsg = "Camera or microphone access was blocked. Please enable permissions in your browser and Windows Privacy Settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        code = "DEVICE_NOT_FOUND";
        userFriendlyMsg = "No physical camera or microphone was found on this computer.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        code = "DEVICE_IN_USE";
        userFriendlyMsg = "Camera or microphone is already in use by another application (e.g. Windows Camera, Teams, Zoom, OBS, Discord) or the hardware is busy.";
      } else if (err.name === "OverconstrainedError") {
        code = "OVERCONSTRAINED";
        userFriendlyMsg = "The camera hardware does not support the requested resolution or format.";
      } else if (err.name === "SecurityError") {
        code = "SECURITY_ERROR";
        userFriendlyMsg = "Access to media devices was denied due to browser security restrictions (HTTPS required).";
      }

      if (this.onDiagnosticEventCallback) {
        this.onDiagnosticEventCallback({
          source: "MEDIA",
          code,
          message: userFriendlyMsg,
          severity: "error",
        });
      }
      return null;
    }
  }

  /**
   * Screen Sharing Handler
   */
  public async startScreenShare(socket?: Socket, localParticipantId?: string): Promise<MediaStream | null> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen capture is not supported on this browser context.");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: true,
      });

      this.screenStream = stream;
      const screenVideoTrack = stream.getVideoTracks()[0];

      if (screenVideoTrack) {
        screenVideoTrack.onended = () => {
          console.log("[RTC] Native browser display track onended triggered");
          this.stopScreenShare(socket, localParticipantId);
          if (this.onScreenShareEndedCallback) {
            this.onScreenShareEndedCallback();
          }
        };

        // Replace video track across all active peer transceivers
        this.peers.forEach(async (peer, targetId) => {
          const transceivers = peer.getTransceivers();
          const videoTrans = transceivers.find((t) => t.receiver.track.kind === "video" || t.sender.track?.kind === "video");
          if (videoTrans) {
            console.log(`[RTC] Replacing video transceiver track with screen track for peer ${targetId}`);
            await videoTrans.sender.replaceTrack(screenVideoTrack);
          }
        });
      }

      return stream;
    } catch (err: any) {
      console.warn("[RTC] Screen share request cancelled or rejected:", err);
      return null;
    }
  }

  public stopScreenShare(socket?: Socket, localParticipantId?: string): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;

      const camTrack = this.localStream?.getVideoTracks()[0] || null;

      this.peers.forEach(async (peer, targetId) => {
        const transceivers = peer.getTransceivers();
        const videoTrans = transceivers.find((t) => t.receiver.track.kind === "video" || t.sender.track?.kind === "video");
        if (videoTrans) {
          console.log(`[RTC] Reverting video transceiver track back to camera for peer ${targetId}`);
          await videoTrans.sender.replaceTrack(camTrack);
        }
      });
    }
  }

  public toggleMute(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      console.log(`[RTC] Local audio tracks enabled=${!muted}`);
    }
  }

  public toggleVideo(off: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !off;
      });
      console.log(`[RTC] Local video tracks enabled=${!off}`);
    }
  }

  /**
   * Create or Retrieve RTCPeerConnection with Exact Transceiver Blueprint
   */
  public createPeer(targetParticipantId: string, socket: Socket, localParticipantId: string): RTCPeerConnection {
    if (this.peers.has(targetParticipantId)) {
      return this.peers.get(targetParticipantId)!;
    }

    console.log(`[RTC] create peer: local=${localParticipantId} remote=${targetParticipantId}`);
    const peer = new RTCPeerConnection(this.rtcConfig);
    this.peers.set(targetParticipantId, peer);
    this.candidateTypes.set(targetParticipantId, new Set());

    // Blueprint: Always configure exactly 1 audio transceiver and 1 video transceiver
    const activeAudioTrack = this.localStream?.getAudioTracks()[0] || null;
    const activeVideoTrack = (this.screenStream?.getVideoTracks()[0] || this.localStream?.getVideoTracks()[0]) || null;

    if (activeAudioTrack) {
      peer.addTrack(activeAudioTrack, this.localStream!);
      console.log(`[RTC] local audio track added for peer ${targetParticipantId}`);
    } else {
      peer.addTransceiver("audio", { direction: "sendrecv" });
    }

    if (activeVideoTrack) {
      peer.addTrack(activeVideoTrack, this.screenStream || this.localStream!);
      console.log(`[RTC] local video track added for peer ${targetParticipantId}`);
    } else {
      peer.addTransceiver("video", { direction: "sendrecv" });
    }

    // ICE Candidate Emission
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        const candType = event.candidate.type || "host";
        this.candidateTypes.get(targetParticipantId)?.add(candType);
        
        socket.emit("signal:candidate", {
          eventId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cand_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          targetParticipantId,
          senderParticipantId: localParticipantId,
          type: "candidate",
          candidate: event.candidate,
          timestamp: Date.now(),
        });
      }
    };

    // Remote Track Reception
    peer.ontrack = (event) => {
      console.log(`[RTC] REMOTE_${event.track.kind.toUpperCase()}_TRACK_RECEIVED participant=${targetParticipantId}`);

      let stream = this.remoteStreams.get(targetParticipantId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(targetParticipantId, stream);
      }

      // Attach track to MediaStream
      const existing = stream.getTracks().find((t) => t.kind === event.track.kind);
      if (existing) {
        stream.removeTrack(existing);
      }
      stream.addTrack(event.track);

      event.track.onmute = () => console.log(`[RTC] Remote ${event.track.kind} track muted for ${targetParticipantId}`);
      event.track.onunmute = () => console.log(`[RTC] Remote ${event.track.kind} track unmuted for ${targetParticipantId}`);
      event.track.onended = () => console.log(`[RTC] Remote ${event.track.kind} track ended for ${targetParticipantId}`);

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(targetParticipantId, stream, "camera");
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log(`[RTC] ICE State for ${targetParticipantId}: ${peer.iceConnectionState}`);
      if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "disconnected") {
        console.log(`[RTC] Network interruption detected for ${targetParticipantId}. Attempting ICE restart...`);
        this.restartIce(targetParticipantId, socket, localParticipantId);
        if (this.onDiagnosticEventCallback) {
          this.onDiagnosticEventCallback({
            source: "ICE",
            code: "ICE_DISCONNECTED",
            message: `Temporary network interruption with ${targetParticipantId}. Auto-recovering ICE...`,
            severity: "warning",
          });
        }
      }
    };

    peer.onconnectionstatechange = () => {
      console.log(`[RTC] Connection State for ${targetParticipantId}: ${peer.connectionState}`);
      if (peer.connectionState === "connected") {
        console.log(`[RTC] Peer ${targetParticipantId} fully CONNECTED`);
      }
    };

    return peer;
  }

  /**
   * Perfect Negotiation: Initiator creates Offer
   */
  public async initiateOffer(targetParticipantId: string, socket: Socket, localParticipantId: string): Promise<void> {
    const peer = this.createPeer(targetParticipantId, socket, localParticipantId);
    this.makingOffer.set(targetParticipantId, true);

    try {
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      if (peer.signalingState !== "stable") return;

      await peer.setLocalDescription(offer);
      console.log(`[RTC] OFFER_CREATED & SENT to ${targetParticipantId}`);

      socket.emit("signal:offer", {
        eventId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `off_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        targetParticipantId,
        senderParticipantId: localParticipantId,
        type: "offer",
        sdp: offer,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.warn(`[RTC] Error creating offer for ${targetParticipantId}:`, err);
      if (this.onDiagnosticEventCallback) {
        this.onDiagnosticEventCallback({
          source: "SIGNALING",
          code: "OFFER_CREATION_FAILED",
          message: err.message || "Failed to create SDP offer.",
          severity: "error",
        });
      }
    } finally {
      this.makingOffer.set(targetParticipantId, false);
    }
  }

  /**
   * Perfect Negotiation: Handle Remote Offer
   */
  public async handleOffer(payload: SignalPayload, socket: Socket, localParticipantId: string): Promise<void> {
    if (!payload.sdp) return;
    const targetId = payload.senderParticipantId;
    const peer = this.createPeer(targetId, socket, localParticipantId);

    const isPolite = localParticipantId > targetId;
    const isOfferCollision = this.makingOffer.get(targetId) || peer.signalingState !== "stable";

    if (isOfferCollision && !isPolite) {
      console.log(`[RTC] Offer collision detected. We are impolite; ignoring incoming offer from ${targetId}`);
      return;
    }

    if (isOfferCollision && isPolite) {
      console.log(`[RTC] Offer collision detected. We are polite; rolling back local offer for ${targetId}`);
      await peer.setLocalDescription({ type: "rollback" } as any);
    }

    console.log(`[RTC] OFFER_RECEIVED from ${targetId}. Setting remote description...`);
    await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));

    await this.drainPendingCandidates(targetId, peer);

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    console.log(`[RTC] ANSWER_CREATED & SENT to ${targetId}`);

    socket.emit("signal:answer", {
      eventId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      targetParticipantId: targetId,
      senderParticipantId: localParticipantId,
      type: "answer",
      sdp: answer,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle Remote Answer
   */
  public async handleAnswer(payload: SignalPayload): Promise<void> {
    if (!payload.sdp) return;
    const targetId = payload.senderParticipantId;
    const peer = this.peers.get(targetId);

    if (peer && (peer.signalingState === "have-local-offer" || peer.signalingState === "have-remote-pranswer")) {
      console.log(`[RTC] ANSWER_RECEIVED from ${targetId}. Setting remote description...`);
      await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      await this.drainPendingCandidates(targetId, peer);
    }
  }

  /**
   * Handle Remote ICE Candidate
   */
  public async handleCandidate(payload: SignalPayload): Promise<void> {
    if (!payload.candidate) return;
    const targetId = payload.senderParticipantId;
    const peer = this.peers.get(targetId);

    if (peer && peer.remoteDescription && peer.remoteDescription.type) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err: any) {
        console.warn(`[RTC] Error adding ICE candidate from ${targetId}:`, err);
      }
    } else {
      const queue = this.pendingCandidates.get(targetId) || [];
      queue.push(payload.candidate);
      this.pendingCandidates.set(targetId, queue);
      console.log(`[RTC] Buffered early ICE candidate for peer: ${targetId}`);
    }
  }

  private async drainPendingCandidates(participantId: string, peer: RTCPeerConnection): Promise<void> {
    const queue = this.pendingCandidates.get(participantId);
    if (queue && queue.length > 0) {
      console.log(`[RTC] Draining ${queue.length} buffered ICE candidates for peer ${participantId}`);
      for (const cand of queue) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn("[RTC] Error adding drained candidate:", err);
        }
      }
      this.pendingCandidates.delete(participantId);
    }
  }

  public async restartIce(targetParticipantId: string, socket: Socket, localParticipantId: string): Promise<void> {
    const peer = this.peers.get(targetParticipantId);
    if (!peer || peer.signalingState === "closed") return;
    try {
      console.log(`[RTC] Initiating ICE restart for ${targetParticipantId}...`);
      if (typeof peer.restartIce === "function") {
        peer.restartIce();
      }
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      console.log(`[RTC] ICE restart offer sent to ${targetParticipantId}`);
      socket.emit("signal:offer", {
        targetParticipantId,
        senderParticipantId: localParticipantId,
        type: "offer",
        sdp: offer,
      });
    } catch (err: any) {
      console.warn(`[RTC] ICE restart failed for ${targetParticipantId}:`, err);
    }
  }

  private initAudioAnalyser(stream: MediaStream): void {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const isSpeaking = average > 18;
        if (this.onSpeakingCallback) {
          this.onSpeakingCallback(isSpeaking, average);
        }
        this.animationFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn("[RTC] Audio analyser initialization failed:", err);
    }
  }

  public getDiagnostics(): {
    peerCount: number;
    peerStates: Record<string, {
      connectionState: string;
      iceState: string;
      iceGatheringState: string;
      signalingState: string;
      candidateTypes: string[];
      remoteVideoTracks: number;
      remoteAudioTracks: number;
      hasRemoteStream: boolean;
    }>;
    hasLocalStream: boolean;
    localVideoTracks: number;
    localAudioTracks: number;
    hasScreenStream: boolean;
  } {
    const peerStates: Record<string, any> = {};
    this.peers.forEach((peer, id) => {
      const remoteStr = this.remoteStreams.get(id);
      const types = Array.from(this.candidateTypes.get(id) || []);
      peerStates[id] = {
        connectionState: peer.connectionState,
        iceState: peer.iceConnectionState,
        iceGatheringState: peer.iceGatheringState,
        signalingState: peer.signalingState,
        candidateTypes: types,
        remoteVideoTracks: remoteStr?.getVideoTracks().length || 0,
        remoteAudioTracks: remoteStr?.getAudioTracks().length || 0,
        hasRemoteStream: !!remoteStr && remoteStr.getTracks().length > 0,
      };
    });

    return {
      peerCount: this.peers.size,
      peerStates,
      hasLocalStream: !!this.localStream,
      localVideoTracks: this.localStream?.getVideoTracks().length || 0,
      localAudioTracks: this.localStream?.getAudioTracks().length || 0,
      hasScreenStream: !!this.screenStream,
    };
  }

  public cleanUpPeer(participantId: string): void {
    const peer = this.peers.get(participantId);
    if (peer) {
      peer.close();
      this.peers.delete(participantId);
      this.pendingCandidates.delete(participantId);
      this.makingOffer.delete(participantId);
      this.remoteStreams.delete(participantId);
      this.candidateTypes.delete(participantId);
    }
  }

  public cleanUpAll(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.pendingCandidates.clear();
    this.makingOffer.clear();
    this.remoteStreams.clear();
    this.candidateTypes.clear();
  }
}

export const webrtc = new WebRTCManager();

import { io, Socket } from "socket.io-client";
import { getWsUrl } from "../utils/apiUrl";

class SocketClientManager {
  private socket: Socket | null = null;
  private activeListenersCount: number = 0;

  public getSocket(token?: string): Socket {
    if (!this.socket) {
      const wsGateway = getWsUrl();
      this.socket = io(wsGateway, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        auth: { token },
      });
    } else if (token && this.socket.auth) {
      this.socket.auth = { token };
    }

    return this.socket;
  }

  public connect(token?: string): Socket {
    const s = this.getSocket(token);
    if (!s.connected) {
      s.connect();
    }
    return s;
  }

  public getStatus(): { connected: boolean; id?: string; listenerCount: number } {
    if (!this.socket) {
      return { connected: false, listenerCount: 0 };
    }
    return {
      connected: this.socket.connected,
      id: this.socket.id,
      listenerCount: (this.socket as any)._callbacks ? Object.keys((this.socket as any)._callbacks).length : 0,
    };
  }

  public removeAllRoomListeners(): void {
    if (this.socket) {
      const events = [
        "room:initial_state",
        "room:participant_joined",
        "room:participant_updated",
        "room:participant_left",
        "room:destroyed",
        "room:error",
        "chat:message_received",
        "chat:reaction_updated",
        "chat:message_deleted",
        "chat:typing",
        "sync:state_updated",
        "signal:offer",
        "signal:answer",
        "signal:candidate",
        "signal:renegotiate",
        "signal:media_state_changed",
      ];
      events.forEach((evt) => this.socket?.off(evt));
      console.log("[WS] Cleaned up all room event listeners");
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.removeAllRoomListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketManager = new SocketClientManager();

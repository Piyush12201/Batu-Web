import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, Function[]> = new Map();
  private pendingEmits: Array<{ event: string; data?: any }> = [];

  /**
   * Initialize socket connection
   */
  async connect(): Promise<void> {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.warn('No auth token found, skipping socket connection');
        return;
      }

      // Disconnect existing connection if any
      if (this.socket?.connected) {
        this.socket.disconnect();
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 10000,
        autoConnect: true
      });

      this.setupConnectionHandlers();
      this.setupEventHandlers();

      console.log('Socket.IO connection initiated');
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.flushPendingEmits();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  /**
   * Setup custom event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Re-register all event handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.socket?.on(event, handler as any);
      });
    });
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.eventHandlers.clear();
      this.pendingEmits = [];
      console.log('Socket disconnected');
    }
  }

  /**
   * Register event listener
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    
    this.eventHandlers.get(event)?.push(handler);
    
    if (this.socket) {
      this.socket.on(event, handler as any);
    }
  }

  /**
   * Unregister event listener
   */
  off(event: string, handler?: Function): void {
    if (handler) {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
      this.socket?.off(event, handler as any);
    } else {
      this.eventHandlers.delete(event);
      this.socket?.off(event);
    }
  }

  /**
   * Emit event
   */
  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Socket not connected. Queuing event: ${event}`);
      this.pendingEmits.push({ event, data });
    }
  }

  /**
   * Flush pending emits
   */
  private flushPendingEmits(): void {
    while (this.pendingEmits.length > 0) {
      const { event, data } = this.pendingEmits.shift()!;
      this.emit(event, data);
    }
  }

  /**
   * Update authentication token
   */
  updateToken(token: string): void {
    if (this.socket) {
      this.socket.auth = { token };
      if (this.socket.connected) {
        this.socket.disconnect();
        this.socket.connect();
      }
    }
  }

  /**
   * Join a room
   */
  joinRoom(room: string): void {
    this.emit('join:room', room);
  }

  /**
   * Leave a room
   */
  leaveRoom(room: string): void {
    this.emit('leave:room', room);
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

const socketService = new SocketService();
export default socketService;

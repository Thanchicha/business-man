import Peer, { type DataConnection } from 'peerjs';

/** Room codes avoid letters that are easy to misread (0/O, 1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'bubble-tea-journey-';

export const newCode = (): string => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

/**
 * A peer-to-peer room over WebRTC. The host's browser holds the game; friends
 * connect straight to it with the room code, so no game server is needed.
 * PeerJS's free public broker only introduces the browsers to each other.
 */
export class Room {
  private conns = new Map<string, DataConnection>();
  onMessage: (msg: any, from: string) => void = () => undefined;
  onJoin: (id: string) => void = () => undefined;
  onLeave: (id: string) => void = () => undefined;
  onClose: (reason: string) => void = () => undefined;
  private closed = false;

  private constructor(
    private peer: Peer,
    readonly host: boolean,
    readonly code: string,
  ) {
    peer.on('disconnected', () => {
      // lost the broker only: existing friends stay connected, but try to come back for new ones
      if (!this.closed) peer.reconnect();
    });
  }

  get myId(): string {
    return this.host ? 'host' : this.peer.id;
  }

  get size(): number {
    return this.conns.size;
  }

  /** Opens a new room; retries with another code if one is taken. */
  static create(tries = 3): Promise<Room> {
    const code = newCode();
    return new Promise((resolve, reject) => {
      const peer = new Peer(PREFIX + code);
      peer.on('open', () => {
        const room = new Room(peer, true, code);
        peer.on('connection', (c) => room.adopt(c, c.peer));
        resolve(room);
      });
      peer.on('error', (err: any) => {
        peer.destroy();
        if (err?.type === 'unavailable-id' && tries > 1) Room.create(tries - 1).then(resolve, reject);
        else reject(err);
      });
    });
  }

  static join(code: string): Promise<Room> {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      const fail = (err: unknown) => {
        peer.destroy();
        reject(err);
      };
      const timer = setTimeout(() => fail(new Error('timeout')), 15000);
      peer.on('error', (err: any) => {
        clearTimeout(timer);
        fail(err?.type === 'peer-unavailable' ? new Error('no-room') : err);
      });
      peer.on('open', () => {
        const c = peer.connect(PREFIX + code, { reliable: true });
        c.on('open', () => {
          clearTimeout(timer);
          const room = new Room(peer, false, code);
          room.adopt(c, 'host');
          resolve(room);
        });
      });
    });
  }

  private adopt(c: DataConnection, id: string): void {
    const ready = () => {
      this.conns.set(id, c);
      if (this.host) this.onJoin(id);
    };
    if (c.open) ready();
    else c.on('open', ready);
    c.on('data', (d) => this.onMessage(d, id));
    const gone = () => {
      if (!this.conns.delete(id)) return;
      if (this.host) this.onLeave(id);
      else this.shut('host-left');
    };
    c.on('close', gone);
    c.on('error', gone);
  }

  /** Host: to everyone, or one friend. Guest: to the host. */
  send(msg: unknown, to?: string): void {
    for (const [id, c] of this.conns) if (!to || id === to) if (c.open) c.send(msg);
  }

  private shut(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.onClose(reason);
    this.peer.destroy();
  }

  close(): void {
    this.shut('left');
  }
}

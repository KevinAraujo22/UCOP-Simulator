import { io, type Socket } from 'socket.io-client';
import type { AckResponse, ClientToServerEvents, ServerToClientEvents } from '@ucop/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(token: string): GameSocket {
  return io({ auth: { token }, transports: ['websocket', 'polling'] });
}

/** Converte a resposta {ok, data | error} do ack em Promise. */
export function unwrap<T>(res: AckResponse<T>): T {
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

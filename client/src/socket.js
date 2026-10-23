import { io } from 'socket.io-client';

// Se conecta al mismo host que sirve la página (tu PC en la clase)
export const socket = io({ transports: ['websocket', 'polling'] });

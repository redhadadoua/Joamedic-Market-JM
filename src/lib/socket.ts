import { io } from "socket.io-client";

// In development, the Vite proxy handles it, or we just connect to the current origin
export const socket = io();

import { io } from 'socket.io-client'

const socketUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const socket = io(socketUrl, {
  autoConnect: false,
  auth: {
    token: ''
  }
})

socket.on('connect', () => {
  console.log('[Socket] connected')
})

socket.on('disconnect', (reason) => {
  console.log('[Socket] disconnected:', reason)
})

export function syncSocketAuth() {
  const token = localStorage.getItem('smartpark_token') || ''
  socket.auth = { token }
}

export function connectSocket() {
  syncSocketAuth()
  if (!socket.connected) {
    socket.connect()
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect()
  }
}

export function joinFacility(facilityId) {
  if (!facilityId) return
  connectSocket()
  socket.emit('join:facility', facilityId)
}

if (typeof window !== 'undefined') {
  syncSocketAuth()
  if (localStorage.getItem('smartpark_token')) {
    connectSocket()
  }
}

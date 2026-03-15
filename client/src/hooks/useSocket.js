import { useEffect } from 'react'
import { connectSocket, socket } from '../lib/socket'

export default function useSocket({ onSlotUpdated, onOccupancyLive } = {}) {
  useEffect(() => {
    connectSocket()

    if (onSlotUpdated) {
      socket.on('slot:updated', onSlotUpdated)
    }

    if (onOccupancyLive) {
      socket.on('occupancy:live', onOccupancyLive)
    }

    return () => {
      if (onSlotUpdated) {
        socket.off('slot:updated', onSlotUpdated)
      }

      if (onOccupancyLive) {
        socket.off('occupancy:live', onOccupancyLive)
      }
    }
  }, [onOccupancyLive, onSlotUpdated])
}

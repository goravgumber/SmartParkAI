let ioInstance = null

export function setIO(io, app = null) {
  ioInstance = io
  if (app?.set) {
    app.set('io', io)
  }
}

export function getIO() {
  return ioInstance
}

export function registerSocketHandlers(io, prisma) {
  io.on('connection', (socket) => {
    console.log('[Socket] client connected:', socket.id)

    socket.on('join:facility', async (facilityId) => {
      try {
        const userId = socket.data?.user?.id
        if (!userId || !facilityId) return
        const facility = await prisma.facility.findUnique({
          where: { id: String(facilityId) },
          select: { id: true }
        })
        if (!facility) return
        socket.join(facility.id)
        console.log('[Socket] joined facility room:', facility.id)
      } catch (_error) {
        // Keep socket failures internal.
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] client disconnected:', socket.id, reason)
    })
  })
}

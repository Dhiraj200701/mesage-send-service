export function startHeartbeat(service) {
  setInterval(async () => {
    try {
      if (!service.client) return;
      await service.client.getState();
    } catch (error) {
      console.log("Heartbeat failed. Reconnecting...");
      await service.destroy();
      await service.initialize();
    }
  }, 60000);
}

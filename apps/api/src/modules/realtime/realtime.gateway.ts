import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeEvents } from './realtime.events';

const REALTIME_NAMESPACE = '/realtime';

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('subscribe.monitor')
  subscribeMonitor(@ConnectedSocket() client: Socket, @MessageBody() body?: unknown) {
    client.join('monitor');
    this.logger.debug(`client ${client.id} subscribed monitor ${JSON.stringify(body ?? {})}`);
    return { event: 'subscribe.monitor', ok: true };
  }

  @SubscribeMessage('subscribe.screen')
  subscribeScreen(@ConnectedSocket() client: Socket, @MessageBody() body?: unknown) {
    client.join('screen');
    this.logger.debug(`client ${client.id} subscribed screen ${JSON.stringify(body ?? {})}`);
    return { event: 'subscribe.screen', ok: true };
  }

  @SubscribeMessage('unsubscribe.monitor')
  unsubscribeMonitor(@ConnectedSocket() client: Socket) {
    client.leave('monitor');
    return { event: 'unsubscribe.monitor', ok: true };
  }

  @SubscribeMessage('unsubscribe.screen')
  unsubscribeScreen(@ConnectedSocket() client: Socket) {
    client.leave('screen');
    return { event: 'unsubscribe.screen', ok: true };
  }

  emitSnapshotUpdated(payload: unknown) {
    this.server?.emit(RealtimeEvents.SnapshotUpdated, payload);
  }

  emitTelemetryCreated(payload: unknown) {
    this.server?.emit(RealtimeEvents.TelemetryCreated, payload);
  }

  emitAlarmCreated(payload: unknown) {
    this.server?.emit(RealtimeEvents.AlarmCreated, payload);
  }

  emitAlarmUpdated(payload: unknown) {
    this.server?.emit(RealtimeEvents.AlarmUpdated, payload);
  }

  emitDeviceStatusChanged(payload: unknown) {
    this.server?.emit(RealtimeEvents.DeviceStatusChanged, payload);
  }

  emitScreenOverviewUpdated(payload: unknown) {
    this.server?.emit(RealtimeEvents.ScreenOverviewUpdated, payload);
  }

  emitScreenMetricsUpdated(payload: { overview?: unknown }) {
    this.server?.emit(RealtimeEvents.ScreenMetricsUpdated, payload);
    if (payload.overview) {
      this.emitScreenOverviewUpdated(payload.overview);
    }
  }
}

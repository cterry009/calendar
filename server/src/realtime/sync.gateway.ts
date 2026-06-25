import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtAccessPayload } from '../auth/auth.types';
import { SyncEventPayload } from '../sync/sync.types';

@WebSocketGateway({
  namespace: '/sync',
  cors: { origin: true },
})
@Injectable()
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SyncGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(
        token,
        {
          secret: this.configService.getOrThrow<string>('auth.accessSecret'),
        },
      );

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      client.data.userId = payload.sub;
      client.data.deviceId = payload.deviceId;
      await client.join(this.userRoom(payload.sub));
      this.logger.debug(`Client connected: user=${payload.sub} device=${payload.deviceId}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.debug(`Client disconnected: user=${client.data.userId ?? 'unknown'}`);
  }

  emitToUser(userId: string, payload: SyncEventPayload) {
    this.server.to(this.userRoom(userId)).emit('sync:changes', payload);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    throw new UnauthorizedException('Missing auth token');
  }
}

import { Injectable } from '@nestjs/common';
import { SyncEventPayload } from '../sync/sync.types';
import { SyncGateway } from './sync.gateway';

@Injectable()
export class SyncEventsService {
  constructor(private readonly syncGateway: SyncGateway) {}

  notifyUser(userId: string, payload: SyncEventPayload) {
    this.syncGateway.emitToUser(userId, payload);
  }
}

import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { SyncEventPayload } from '../sync/sync.types';
import { SyncGateway } from './sync.gateway';

@Injectable()
export class SyncEventsService {
  private readonly tasksWritten = new Subject<string>();
  /** User ids whose tasks were just created or edited through sync (planning rates the new ones). */
  readonly tasksWritten$ = this.tasksWritten.asObservable();

  constructor(private readonly syncGateway: SyncGateway) {}

  taskWritten(userId: string) {
    this.tasksWritten.next(userId);
  }

  notifyUser(userId: string, payload: SyncEventPayload) {
    this.syncGateway.emitToUser(userId, payload);
  }
}

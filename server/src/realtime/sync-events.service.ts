import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { SyncEntityType, SyncEventPayload } from '../sync/sync.types';

export interface BatchApplied {
  userId: string;
  entities: SyncEntityType[];
}
import { SyncGateway } from './sync.gateway';

@Injectable()
export class SyncEventsService {
  private readonly tasksWritten = new Subject<string>();
  /** User ids whose tasks were just created or edited through sync (planning rates the new ones). */
  readonly tasksWritten$ = this.tasksWritten.asObservable();
  private readonly batchesApplied = new Subject<BatchApplied>();
  /** Every sync batch that changed something, with what (the study status follows it, 2026-10-22). */
  readonly batchesApplied$ = this.batchesApplied.asObservable();

  constructor(private readonly syncGateway: SyncGateway) {}

  taskWritten(userId: string) {
    this.tasksWritten.next(userId);
  }

  notifyUser(userId: string, payload: SyncEventPayload) {
    this.syncGateway.emitToUser(userId, payload);
    this.batchesApplied.next({ userId, entities: payload.entities });
  }
}

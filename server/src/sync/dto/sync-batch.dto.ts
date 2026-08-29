import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BlockListKind,
  BlockListScope,
  DevicePlatform,
  FitnessIntensity,
  FitnessSource,
  FocusTriggerKind,
  HabitRecordStatus,
  HabitType,
  PomodoroState,
  ScheduleKind,
  TaskDifficulty,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';

export class TaskSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ValidateIf((item) => !item.deleted)
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedPomodoros?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualMinutes?: number;

  @IsOptional()
  @IsEnum(TaskDifficulty)
  difficulty?: TaskDifficulty;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  complexity?: number;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}

export class ScheduleSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsEnum(ScheduleKind)
  kind?: ScheduleKind;

  @ValidateIf((item) => !item.deleted)
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ValidateIf((item) => !item.deleted)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute?: number;

  @ValidateIf((item) => !item.deleted)
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinute?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  pomodoroMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  shortBreakMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  longBreakMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  pomodorosPerChunk?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  chunks?: number;
}

export class PomodoroSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsEnum(PomodoroState)
  state?: PomodoroState;

  @IsOptional()
  @IsInt()
  @Min(1)
  focusDurationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  shortBreakMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  longBreakMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cyclesBeforeLongBreak?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  completedCycles?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  interrupted?: boolean;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;
}

export class BlockListSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsEnum(BlockListKind)
  kind?: BlockListKind;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  identifier?: string;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;

  @IsOptional()
  @IsBoolean()
  highDopamine?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  hardMode?: boolean;

  // Task 11.8. Defaults to FOCUS server-side (see sync.service.ts) when omitted, which is what
  // every pre-11.8 client (still unaware of NIGHT) continues to send implicitly.
  @IsOptional()
  @IsEnum(BlockListScope)
  scope?: BlockListScope;
}

export class FocusTriggerSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsEnum(FocusTriggerKind)
  kind?: FocusTriggerKind;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(50000)
  radiusMeters?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  wifiSsid?: string;
}

export class FitnessSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  activityType?: string;

  @ValidateIf((item) => !item.deleted)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(FitnessIntensity)
  intensity?: FitnessIntensity;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateIf((item) => !item.deleted)
  @IsDateString()
  loggedAt?: string;

  @IsOptional()
  @IsEnum(FitnessSource)
  source?: FitnessSource;

  @IsOptional()
  @IsString()
  externalId?: string;
}

// No `deleted` flag -- unlike FitnessEntry, a daily step count is a per-day aggregate the user
// never deletes through the UI; a wrong value gets corrected by the next sync merging in a fresh
// count, not by removing the row (see SyncService.applyStepCountChange for the merge rule).
export class StepCountSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  steps!: number;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsEnum(FitnessSource)
  source?: FitnessSource;
}

// No `deleted` flag -- same reasoning as StepCountSyncChangeDto, a per-day aggregate that gets
// corrected by a fresh sync, not removed via the UI.
export class FloorsClimbedSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  floors!: number;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsEnum(FitnessSource)
  source?: FitnessSource;
}

export class DetoxPlanSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsObject()
  planData?: Record<string, unknown>;
}

export class SerotoninSessionSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsObject()
  sessionData?: Record<string, unknown>;
}

export class HabitSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(HabitType)
  type?: HabitType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyGoalValue?: number;

  @IsOptional()
  @IsString()
  dailyGoalUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyGoalExtraValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  targetDays?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsString()
  linkedFitnessActivityType?: string;

  // Task 11.5. Minutes since local midnight (0-1439), same convention as ScheduleSyncChangeDto's
  // startMinute/endMinute above -- reminderEndMinute doubles as the notification's fire time.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  reminderStartMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  reminderEndMinute?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  reminderDaysOfWeek?: number[];
}

export class HabitRecordSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  habitId?: string;

  @ValidateIf((item) => !item.deleted)
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsEnum(HabitRecordStatus)
  status?: HabitRecordStatus;

  @IsOptional()
  @IsBoolean()
  autoCompleted?: boolean;

  @IsOptional()
  @IsString()
  fitnessEntryId?: string;
}

export class JournalEntrySyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  habitId?: string;

  @IsOptional()
  @IsString()
  recordId?: string;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  content?: string;
}

export class SyncBatchDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskSyncChangeDto)
  tasks?: TaskSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSyncChangeDto)
  schedules?: ScheduleSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PomodoroSyncChangeDto)
  pomodoroSessions?: PomodoroSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockListSyncChangeDto)
  blockListEntries?: BlockListSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FocusTriggerSyncChangeDto)
  focusTriggers?: FocusTriggerSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FitnessSyncChangeDto)
  fitnessEntries?: FitnessSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepCountSyncChangeDto)
  dailyStepCounts?: StepCountSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorsClimbedSyncChangeDto)
  dailyFloorsClimbed?: FloorsClimbedSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetoxPlanSyncChangeDto)
  detoxPlan?: DetoxPlanSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SerotoninSessionSyncChangeDto)
  serotoninSession?: SerotoninSessionSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HabitSyncChangeDto)
  habits?: HabitSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HabitRecordSyncChangeDto)
  habitRecords?: HabitRecordSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntrySyncChangeDto)
  journalEntries?: JournalEntrySyncChangeDto[];
}

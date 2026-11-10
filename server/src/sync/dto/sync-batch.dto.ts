import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  AttentionProfile,
  AttentionSource,
  BlockEventTrigger,
  BlockListKind,
  BlockListScope,
  DevicePlatform,
  ExerciseGrader,
  ExerciseSource,
  FitnessIntensity,
  FitnessSource,
  FocusEventKind,
  FocusTriggerKind,
  HabitKind,
  HabitRecordStatus,
  ScheduleCompletionStatus,
  HabitType,
  PomodoroState,
  ProjectLogSource,
  ProjectPriority,
  ProjectStatus,
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

  // Attention rating (docs/planning/normas-de-atencion.md). Omitted = leave as is; null = clear.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  attentionReentry?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  attentionLoad?: number | null;

  @IsOptional()
  @IsEnum(AttentionProfile)
  attentionProfile?: AttentionProfile | null;

  @IsOptional()
  @IsEnum(AttentionSource)
  attentionSource?: AttentionSource | null;

  @IsOptional()
  @IsString()
  attentionReason?: string | null;

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

  // projects-and-claude-bridge: null unlinks; omitted keeps the current project. A project that
  // isn't the user's (or was deleted) is stored as no project.
  @IsOptional()
  @IsString()
  projectId?: string | null;
}

// One segment of a block's pomodoro sequence (horario 2026-10-19).
export class SequenceSegmentDto {
  @IsIn(['foco', 'pausa', 'cierre'])
  tipo!: 'foco' | 'pausa' | 'cierre';

  @IsInt()
  @Min(1)
  @Max(600)
  minutos!: number;

  @IsString()
  @MaxLength(200)
  etiqueta!: string;
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

  // Plan category and pomodoro sequence (horario 2026-10-19); null clears them.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SequenceSegmentDto)
  sequence?: SequenceSegmentDto[] | null;

  // The morning window (dynamic-study-blocks, 2026-10-22): blocks started on demand in it; null = a
  // fixed block. Not sent (an older client) keeps what the schedule has.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  flexibleBlocks?: number | null;
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

  // Block mode (a session for a WORK block, ending at its fixed end).
  @IsOptional()
  @IsDateString()
  blockEndAt?: string | null;

  @IsOptional()
  @IsEnum(AttentionProfile)
  attentionProfile?: AttentionProfile | null;

  // The WORK block it belongs to; paused ("Salir") and how many times the user left it.
  @IsOptional()
  @IsString()
  scheduleId?: string | null;

  @IsOptional()
  @IsDateString()
  pausedAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  exitCount?: number;

  // Focus pomodoros already rated or dismissed (any device); the server keeps the max.
  @IsOptional()
  @IsInt()
  @Min(0)
  reviewedCycles?: number;

  // Sequence mode: segments anchored to blockStartAt, the running one, "cortar tramo" uses (max).
  @IsOptional()
  @IsDateString()
  blockStartAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SequenceSegmentDto)
  sequence?: SequenceSegmentDto[] | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  segmentIndex?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  cutCount?: number;

  // Flexible morning block (2026-10-22): relative sequence, the window's end, the check-in's length
  // and the real focus done (the server keeps the max).
  @IsOptional()
  @IsBoolean()
  flexible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  plannedBlockMin?: number | null;

  @IsOptional()
  @IsDateString()
  windowEndAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  focusMinutes?: number;
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

  // weekend-mode: a NIGHT entry's own start times (null = the night window's). Omitted by older
  // clients: kept as they were.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  nightStartMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  weekendNightStartMinutes?: number | null;
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

// Task 8.3, one entry of DailyScreenTimeSyncChangeDto.topApps below.
export class TopAppUsageDto {
  @IsString()
  @MinLength(1)
  packageName!: string;

  @IsInt()
  @Min(0)
  minutes!: number;
}

// No `deleted` flag, same reasoning as StepCountSyncChangeDto/FloorsClimbedSyncChangeDto -- a
// per-day aggregate that gets corrected by a fresh sync, not removed via the UI. `topApps` capped
// at 10 -- this is a display snapshot, not a full per-app ledger.
export class DailyScreenTimeSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  totalMinutes!: number;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TopAppUsageDto)
  topApps!: TopAppUsageDto[];

  @IsDateString()
  updatedAt!: string;
}

// Windows desktop counterpart of TopAppUsageDto/DailyScreenTimeSyncChangeDto -- see
// DailyGameTime's schema.prisma doc comment. `source` is "STEAM" | "RIOT" | "BATTLENET".
export class TopGameUsageDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsInt()
  @Min(0)
  minutes!: number;

  @IsString()
  @MinLength(1)
  source!: string;
}

// Same shape and reasoning as DailyScreenTimeSyncChangeDto: no `deleted` flag (a per-day
// aggregate corrected by the next sync, not removed via the UI), `topGames` capped at 10.
export class DailyGameTimeSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  totalMinutes!: number;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TopGameUsageDto)
  topGames!: TopGameUsageDto[];

  @IsDateString()
  updatedAt!: string;
}

// One entry of DailyDesktopAppTimeSyncChangeDto.topApps -- see DailyDesktopAppTime's schema.prisma
// doc comment. `key` is the lowercased exe name (also what a DESKTOP_APP block-list entry matches
// on), `label` the resolved display name. No `source`, unlike TopGameUsageDto: there is a single
// detector here (the foreground window), not three.
export class TopDesktopAppUsageDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsInt()
  @Min(0)
  minutes!: number;
}

// Same shape and reasoning as DailyScreenTimeSyncChangeDto/DailyGameTimeSyncChangeDto: no
// `deleted` flag (a per-day aggregate corrected by the next sync, not removed via the UI), and
// `topApps` capped at 10 -- a display snapshot, not a full per-app ledger.
export class DailyDesktopAppTimeSyncChangeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  totalMinutes!: number;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TopDesktopAppUsageDto)
  topApps!: TopDesktopAppUsageDto[];

  @IsDateString()
  updatedAt!: string;
}

// Task 8.2. `id` is required and client-generated (a UUID, from the native focus-block module) --
// unlike every other DTO's optional server-assigned id, this one has to be stable across a retried
// offline-queue flush, since it's the only idempotency key a pure "record this happened" event has.
// No `deleted`/update path -- a block event is never edited or removed once logged.
export class BlockEventSyncChangeDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsOptional()
  @IsString()
  identifier?: string;

  @IsEnum(BlockListScope)
  scope!: BlockListScope;

  @IsEnum(BlockEventTrigger)
  trigger!: BlockEventTrigger;

  @IsDateString()
  occurredAt!: string;
}

// Focus-block telemetry. Same shape of contract as BlockEventSyncChangeDto: a client-generated id
// is the idempotency key, and an event is never edited or removed once logged.
export class FocusEventSyncChangeDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsEnum(FocusEventKind)
  kind!: FocusEventKind;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  pomodoroSessionId?: string;

  @IsOptional()
  @IsEnum(AttentionProfile)
  attentionProfile?: AttentionProfile;

  @IsOptional()
  @IsDateString()
  blockStartAt?: string;

  @IsOptional()
  @IsInt()
  value?: number;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

// A graded try at a study exercise (study-tutor-game phase 2, 2026-10-21). Immutable like a focus
// event: the client id is the idempotency key and a regrade is a new attempt with `supersedes`.
// Only the shape is checked here; whether a generated exercise makes sense is the tutor's job.
export class ExerciseAttemptSyncChangeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  exerciseId!: string;

  @IsEnum(ExerciseSource)
  exerciseSource!: ExerciseSource;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  noteCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  section!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-6)
  @Max(6)
  b!: number;

  @IsIn([0, 0.5, 1])
  r!: 0 | 0.5 | 1;

  @IsInt()
  @Min(0)
  hints!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minutes?: number | null;

  @IsEnum(ExerciseGrader)
  gradedBy!: ExerciseGrader;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supersedes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  generatedStatement?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  feedback?: string | null;

  @IsOptional()
  @IsString()
  studyTaskId?: string | null;

  @IsOptional()
  @IsString()
  pomodoroSessionId?: string | null;

  @IsDateString()
  occurredAt!: string;
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

  // weekend-mode: a weekend activity (3 a day at most, checked in sync.service.ts). Omitted by older
  // clients: kept as it was, HABIT for a new one.
  @IsOptional()
  @IsEnum(HabitKind)
  kind?: HabitKind;
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

// A schedule block marked done on a day. Undo = deleted:true. `date` is the local day
// (YYYY-MM-DD); see ScheduleCompletion in schema.prisma.
export class ScheduleCompletionSyncChangeDto {
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

  @IsOptional()
  @IsString()
  @MinLength(1)
  scheduleId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  // DONE (default) or SKIPPED ("no puedo hacer este bloque"), with an optional reason.
  @IsOptional()
  @IsEnum(ScheduleCompletionStatus)
  status?: ScheduleCompletionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

// A one-off change to a block on one day (moved, or another category). Undo = deleted:true.
// `date` is the local day (YYYY-MM-DD), same as ScheduleCompletion.
export class ScheduleExceptionSyncChangeDto {
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

  @IsOptional()
  @IsString()
  @MinLength(1)
  scheduleId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute?: number | null;
}

// The phased study plan, one per user (like DetoxPlan).
export class StudyPlanSyncChangeDto {
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

// projects-and-claude-bridge (2026-11-08): a project and one entry of its progress log.
export class ProjectSyncChangeDto {
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
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsEnum(ProjectPriority)
  priority?: ProjectPriority;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string | null;

  /** YYYY-MM-DD; null clears it. */
  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  /** 0-100; null = not estimated. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  nextSteps?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  blocker?: string | null;

  /** Left out = keep what's stored (older clients don't send these). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  generalObjective?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProjectObjectiveDto)
  specificObjectives?: ProjectObjectiveDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  localPath?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProjectLinkDto)
  links?: ProjectLinkDto[];
}

export class ProjectLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  path!: string;
}

export class ProjectObjectiveDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text!: string;

  @IsBoolean()
  done!: boolean;
}

export class ProjectLogEntrySyncChangeDto {
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
  projectId?: string;

  /** YYYY-MM-DD, the local day of the entry. */
  @ValidateIf((item) => !item.deleted)
  @IsDateString()
  date?: string;

  @ValidateIf((item) => !item.deleted)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text?: string;

  @IsOptional()
  @IsEnum(ProjectLogSource)
  source?: ProjectLogSource;
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
  @Type(() => BlockEventSyncChangeDto)
  blockEvents?: BlockEventSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FocusEventSyncChangeDto)
  focusEvents?: FocusEventSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseAttemptSyncChangeDto)
  exerciseAttempts?: ExerciseAttemptSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyScreenTimeSyncChangeDto)
  dailyScreenTime?: DailyScreenTimeSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyGameTimeSyncChangeDto)
  dailyGameTime?: DailyGameTimeSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyDesktopAppTimeSyncChangeDto)
  dailyDesktopAppTime?: DailyDesktopAppTimeSyncChangeDto[];

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
  @Type(() => ProjectSyncChangeDto)
  projects?: ProjectSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectLogEntrySyncChangeDto)
  projectLogEntries?: ProjectLogEntrySyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HabitRecordSyncChangeDto)
  habitRecords?: HabitRecordSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleCompletionSyncChangeDto)
  scheduleCompletions?: ScheduleCompletionSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntrySyncChangeDto)
  journalEntries?: JournalEntrySyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleExceptionSyncChangeDto)
  scheduleExceptions?: ScheduleExceptionSyncChangeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudyPlanSyncChangeDto)
  studyPlan?: StudyPlanSyncChangeDto[];
}

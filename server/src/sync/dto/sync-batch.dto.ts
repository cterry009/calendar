import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
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
  DevicePlatform,
  FitnessIntensity,
  FitnessSource,
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
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

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
  @Type(() => FitnessSyncChangeDto)
  fitnessEntries?: FitnessSyncChangeDto[];
}

import type { DetoxPlan } from './index.js';
import { getDetoxDayPlan } from './index.js';

export type ScheduleIntensity = 'low' | 'medium' | 'high';

export const INTENSITY_LABELS: Record<ScheduleIntensity, string> = {
  low: 'Baja intensidad',
  medium: 'Media intensidad',
  high: 'Alta intensidad',
};

export interface DetoxScheduleProposal {
  kind: 'WORK' | 'REST';
  intensity: ScheduleIntensity;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  label: string;
  reason: string;
}

const WEEKDAY_FOCUS_DAYS = [1, 2, 3, 4, 5];

function workBlock(
  dayOfWeek: number,
  startHour: number,
  endHour: number,
  intensity: ScheduleIntensity,
  label: string,
  reason: string,
): DetoxScheduleProposal {
  return {
    kind: 'WORK',
    intensity,
    dayOfWeek,
    startMinute: startHour * 60,
    endMinute: endHour * 60,
    label,
    reason,
  };
}

function restBlock(
  dayOfWeek: number,
  startHour: number,
  endHour: number,
  intensity: ScheduleIntensity,
  label: string,
  reason: string,
): DetoxScheduleProposal {
  return {
    kind: 'REST',
    intensity,
    dayOfWeek,
    startMinute: startHour * 60,
    endMinute: endHour * 60,
    label,
    reason,
  };
}

function proposalsForPhase(phase: string, day: number): DetoxScheduleProposal[] {
  switch (phase) {
    case 'audit':
      return [
        workBlock(1, 9, 10, 'low', '[Detox] Auditoria consciente', 'Bloque suave para registrar habitos sin presion'),
        restBlock(1, 10, 11, 'low', '[Detox] Pausa de reflexion', 'Espacio para anotar distracciones detectadas'),
        workBlock(3, 18, 19, 'low', '[Detox] Revision de pantalla', 'Revisa estimaciones de tiempo de pantalla del dia'),
        restBlock(5, 20, 21, 'medium', '[Detox] Tarde sin estimulos', 'Ventana de descanso digital antes de dormir'),
      ];
    case 'reduction':
      return WEEKDAY_FOCUS_DAYS.flatMap((dayOfWeek) => [
        workBlock(dayOfWeek, 9, 11, 'high', `[Detox D${day}] Foco profundo`, 'Ventana de alta intensidad sin estimulos principales'),
        restBlock(dayOfWeek, 11, 12, 'medium', `[Detox D${day}] Pausa activa`, 'Sustituye el scroll por movimiento o respiracion'),
        workBlock(dayOfWeek, 15, 16, 'medium', `[Detox D${day}] Foco moderado`, 'Segunda ventana con limites en estímulos reducidos'),
      ]);
    case 'reintroduction':
      return [
        workBlock(2, 10, 12, 'medium', '[Detox] Foco planificado', 'Trabajo con ventanas de estímulo controladas'),
        restBlock(2, 12, 13, 'low', '[Detox] Comida consciente', 'Sin pantallas durante la comida'),
        workBlock(4, 16, 17, 'low', '[Detox] Ventana permitida', 'Uso planificado del estímulo #1 con check-in de animo'),
        restBlock(6, 19, 20, 'medium', '[Detox] Consolidacion', 'Refuerza limites acordados el fin de semana'),
      ];
    case 'maintenance':
      return [
        workBlock(1, 9, 12, 'high', '[Detox] Bloque de mantenimiento', 'Consolida habitos de foco profundo'),
        restBlock(1, 12, 13, 'low', '[Detox] Recuperacion', 'Descanso sin pantallas de alta dopamina'),
        workBlock(3, 9, 11, 'medium', '[Detox] Ritmo sostenible', 'Intensidad media con modo serotonina'),
        workBlock(5, 17, 18, 'low', '[Detox] Revision semanal', 'Ajusta limites personales y revisa progreso'),
      ];
    default:
      return [];
  }
}

export function proposeDetoxSchedules(plan: DetoxPlan): DetoxScheduleProposal[] {
  const dayPlan = getDetoxDayPlan(plan);
  if (!dayPlan) {
    return [];
  }

  return proposalsForPhase(dayPlan.phase, dayPlan.day);
}

export function formatDetoxScheduleLabel(proposal: DetoxScheduleProposal): string {
  return `${proposal.label} · ${INTENSITY_LABELS[proposal.intensity]}`;
}

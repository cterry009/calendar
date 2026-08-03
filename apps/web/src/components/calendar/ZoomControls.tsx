import { AppButton, Text, XStack } from '@calendar/ui';
import { ZOOM_MAX, ZOOM_MIN } from './timeGridLayout';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

/** Small +/- control for the time-grid views. Also supports Ctrl/Cmd+wheel zoom on the grid itself. */
export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <XStack alignItems="center" gap="$1">
      <AppButton
        variant="ghost"
        size="$2"
        disabled={zoom <= ZOOM_MIN}
        onPress={onZoomOut}
        title="Reducir zoom"
      >
        −
      </AppButton>
      <Text
        fontSize="$1"
        color="$muted"
        minWidth={40}
        textAlign="center"
        cursor="pointer"
        onPress={onReset}
        title="Restablecer zoom (100%)"
      >
        {Math.round(zoom * 100)}%
      </Text>
      <AppButton
        variant="ghost"
        size="$2"
        disabled={zoom >= ZOOM_MAX}
        onPress={onZoomIn}
        title="Aumentar zoom"
      >
        +
      </AppButton>
    </XStack>
  );
}

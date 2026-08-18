import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { YStack } from '@calendar/ui';
import { usePanel } from '../../context/PanelContext';

const PANEL_WIDTH = 560;

export function SlideOverPanel({ children }: { children: ReactNode }) {
  const { activePanel, closePanel } = usePanel();

  useEffect(() => {
    if (!activePanel) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePanel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, closePanel]);

  if (!activePanel || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <YStack position="fixed" top={0} left={0} right={0} bottom={0} zIndex={500}>
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        backgroundColor="rgba(10, 14, 12, 0.6)"
        animation="quick"
        enterStyle={{ opacity: 0 }}
        opacity={1}
        onPress={closePanel}
      />

      <YStack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        width={`min(${PANEL_WIDTH}px, 92vw)`}
        maxWidth="100%"
        overflow="hidden"
        borderLeftWidth={1}
        borderLeftColor="$borderColor"
        shadowColor="$shadowColor"
        shadowRadius={40}
        shadowOffset={{ width: 0, height: 0 }}
        shadowOpacity={1}
        animation="quick"
        enterStyle={{ x: PANEL_WIDTH, opacity: 0 }}
        x={0}
        opacity={1}
      >
        <YStack flex={1} overflow="scroll">
          {children}
        </YStack>
      </YStack>
    </YStack>,
    document.body,
  );
}

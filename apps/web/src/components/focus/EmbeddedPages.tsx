import { useEffect, useRef, useState } from 'react';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { RADAR_PAGES } from '../agenda/RadarLinks';
import { isDesktop } from '../../lib/desktop';
import { openExternalPage } from '../../lib/desktop/openPage';

// 2026-11-11: a block that works on a claude.ai page (radars, reading log) shows that page where the
// tutor's chat would be. claude.ai can't be put in an iframe (frame-ancestors 'self'), so on the
// desktop it is a native child webview laid over this pane; it keeps its own claude.ai session
// (sign in once inside it). In a plain browser the pane offers a link instead.

export interface EmbeddedPage {
  title: string;
  url: string;
}

const byTitle = (titles: string[]): EmbeddedPage[] =>
  titles
    .map((t) => RADAR_PAGES.find((p) => p.title === t))
    .filter((p): p is (typeof RADAR_PAGES)[number] => !!p)
    .map((p) => ({ title: p.title, url: p.url }));

/** The pages a schedule block works on, from its label. */
export function blockPages(label: string | null | undefined): EmbeddedPage[] {
  if (!label) return [];
  if (/maestr/i.test(label)) return byTitle(['Radar de maestrías', 'Radar de maestrías – documento']);
  if (/investigaci|paper|pinn/i.test(label))
    return byTitle(['Radar de investigadores – PINNs y control estocástico', 'Bitácora de lectura PINN']);
  return [];
}

type Tauri = {
  Webview: typeof import('@tauri-apps/api/webview').Webview;
  getCurrentWindow: typeof import('@tauri-apps/api/window').getCurrentWindow;
  LogicalPosition: typeof import('@tauri-apps/api/dpi').LogicalPosition;
  LogicalSize: typeof import('@tauri-apps/api/dpi').LogicalSize;
};

async function loadTauri(): Promise<Tauri> {
  const [webview, win, dpi] = await Promise.all([
    import('@tauri-apps/api/webview'),
    import('@tauri-apps/api/window'),
    import('@tauri-apps/api/dpi'),
  ]);
  return {
    Webview: webview.Webview,
    getCurrentWindow: win.getCurrentWindow,
    LogicalPosition: dpi.LogicalPosition,
    LogicalSize: dpi.LogicalSize,
  };
}

export function EmbeddedPages({
  pages,
  zoom,
  suspended = false,
}: {
  pages: EmbeddedPage[];
  zoom: number;
  /** Hidden while the divider is dragged: a native webview would swallow the pointer. */
  suspended?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)];
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<InstanceType<Tauri['Webview']> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktop || !page || !host.current) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let timer: number | undefined;
    let wv: InstanceType<Tauri['Webview']> | null = null;
    setError(null);

    void (async () => {
      try {
        const t = await loadTauri();
        if (cancelled || !host.current) return;
        const r = host.current.getBoundingClientRect();
        wv = new t.Webview(t.getCurrentWindow(), `embed-${Date.now()}`, {
          url: page.url,
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.max(1, Math.round(r.width)),
          height: Math.max(1, Math.round(r.height)),
        });
        void wv.once('tauri://error', (e) => setError(String(e.payload)));
        if (cancelled) {
          void wv.close();
          return;
        }
        view.current = wv;
        void wv.setZoom(zoom).catch(() => undefined);
        // Follow the pane: its size (divider, header) and its place (folding the pomodoro).
        let last = '';
        const place = () => {
          if (!wv || !host.current) return;
          const b = host.current.getBoundingClientRect();
          const key = `${b.left}|${b.top}|${b.width}|${b.height}`;
          if (key === last) return;
          last = key;
          void wv.setPosition(new t.LogicalPosition(Math.round(b.left), Math.round(b.top)));
          void wv.setSize(new t.LogicalSize(Math.max(1, Math.round(b.width)), Math.max(1, Math.round(b.height))));
        };
        observer = new ResizeObserver(place);
        observer.observe(host.current);
        timer = window.setInterval(place, 400);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (timer) window.clearInterval(timer);
      if (wv) void wv.close();
      view.current = null;
    };
  }, [page?.url]); // one webview per page; recreated when the tab changes

  useEffect(() => {
    void view.current?.setZoom(zoom).catch(() => undefined);
  }, [zoom]);

  useEffect(() => {
    const wv = view.current;
    if (!wv) return;
    void (suspended ? wv.hide() : wv.show()).catch(() => undefined);
  }, [suspended]);

  if (!page) return null;
  return (
    <YStack flex={1} minWidth={0} minHeight={0} gap="$2">
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        {pages.map((p, i) => (
          <AppButton
            key={p.url}
            size="$2"
            variant={p.url === page.url ? 'primary' : 'ghost'}
            onPress={() => setIndex(i)}
          >
            {p.title}
          </AppButton>
        ))}
        <AppButton size="$2" variant="ghost" marginLeft="auto" onPress={() => void openExternalPage(page.url, page.title)}>
          Abrir en el navegador ↗
        </AppButton>
      </XStack>
      {error ? (
        <Paragraph margin={0} color="$error" size="$2">
          No se pudo cargar la página aquí: {error}
        </Paragraph>
      ) : null}
      <div
        ref={host}
        style={{
          flex: '1 1 0',
          minHeight: 0,
          borderRadius: 8,
          border: '1px solid rgba(127,127,127,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isDesktop ? (
          <Text color="$muted" fontSize="$2">
            Cargando {page.title}…
          </Text>
        ) : (
          <AppButton variant="primary" onPress={() => void openExternalPage(page.url, page.title)}>
            Abrir {page.title}
          </AppButton>
        )}
      </div>
    </YStack>
  );
}

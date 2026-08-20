// Monorepo resolution for @calendar/shared and @calendar/ui, which live as plain TypeScript
// source in sibling packages (no npm workspaces / no build step consumed here -- same
// source-first pattern apps/web already uses via its Vite `resolve.alias`, see
// apps/web/vite.config.ts). Metro only watches/resolves within its own project root by
// default, so both watchFolders and extraNodeModules need to point at those packages.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const sharedPackage = path.resolve(monorepoRoot, 'packages/shared');
const uiPackage = path.resolve(monorepoRoot, 'packages/ui');
const sharedSrc = path.resolve(sharedPackage, 'src');
const uiSrc = path.resolve(uiPackage, 'src');

const config = getDefaultConfig(projectRoot);

// expo-sqlite's web implementation (wa-sqlite, used so `expo start --web` -- the only
// verification path in this environment -- can exercise the same offline-cache/queue code as
// native) ships a .wasm file Metro doesn't know how to resolve or serve by default: it needs
// registering as an asset extension, and the wa-sqlite worker needs cross-origin isolation
// (COOP/COEP headers) to use SharedArrayBuffer.
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  return middleware(req, res, next);
};

// Metro only resolves node_modules inside its watched folders -- watching the *package* roots
// (not just their src/) is what lets it also find packages/ui's own node_modules (tamagui,
// @tamagui/animations-react-native, etc.), which those source files import as bare specifiers.
config.watchFolders = [sharedPackage, uiPackage];

// packages/ui/src imports peer deps (react, react/jsx-runtime) it deliberately does NOT install
// itself, matching how apps/web supplies them today -- Metro's plain ancestor-directory walk
// from a file physically inside packages/ui/src has no path back to apps/mobile/node_modules to
// find them. A Proxy fallback (the standard Expo monorepo pattern) makes any module name Metro
// can't resolve locally fall back to this app's own node_modules, so there's one real copy of
// react shared by every workspace package instead of each one needing its own.
const explicitExtraNodeModules = {
  '@calendar/shared': sharedSrc,
  '@calendar/ui': uiSrc,
};
config.resolver.extraNodeModules = new Proxy(explicitExtraNodeModules, {
  get(target, name) {
    if (name in target) {
      return target[name];
    }
    return path.join(projectRoot, 'node_modules', name);
  },
});

const { resolveRequest: defaultResolveRequest } = config.resolver;
// A fake origin inside this app's own root -- used below to force certain imports to resolve
// as if they came from here, regardless of which physical file actually requested them.
const appOrigin = path.join(projectRoot, 'package.json');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  // @calendar/shared's source imports its own siblings with explicit NodeNext-style ".js"
  // extensions (it compiles to real ESM via tsc for the web/server consumers, see
  // packages/shared/src/index.ts) even though the files on disk are ".ts". Vite resolves that
  // transparently; Metro doesn't, so relative ".js" imports are rewritten to extension-less
  // before falling through to Metro's own .ts/.tsx probing.
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    return resolve(context, moduleName.slice(0, -'.js'.length), platform);
  }

  // packages/ui and packages/shared each carry their own node_modules (needed for their
  // standalone typecheck/lint scripts) that happen to include some of the same packages this
  // app also installs -- react and the whole @tamagui/* family. Left alone, Metro resolves
  // those bare imports against whichever copy lives closest to the *importing* file, which
  // gives the app two separate Tamagui module instances with two separate theme/animation
  // registries; the app's TamaguiProvider (built from this app's instance) then can't make
  // sense of a styled AppButton built from packages/ui's instance, which is what was actually
  // behind the "Cannot read properties of null (reading 'map')" crash inside <Button>, not a
  // real Tamagui/React Native bug. Bare (non-@calendar) imports from those two source trees are
  // forced to resolve as if they came from this app instead, so there's exactly one instance of
  // everything, matching how a real hoisted monorepo install would behave.
  const isBareImport = !moduleName.startsWith('.') && !moduleName.startsWith('/');
  const isWorkspaceAlias = moduleName === '@calendar/shared' || moduleName === '@calendar/ui' || moduleName.startsWith('@calendar/ui/');
  const isFromWorkspacePackage = context.originModulePath.startsWith(uiSrc) || context.originModulePath.startsWith(sharedSrc);
  if (isBareImport && !isWorkspaceAlias && isFromWorkspacePackage) {
    return resolve({ ...context, originModulePath: appOrigin }, moduleName, platform);
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;

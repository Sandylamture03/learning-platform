// The Phase 2 widgets are plain JavaScript with JSDoc types. The shell needs only their default export, the
// UiModule it mounts, so it declares that rather than type-checking the widgets' source again.
declare module '@lp/widgets/quiz' {
  const quiz: import('@lp/platform-kit').UiModule;
  export default quiz;
}

declare module '@lp/widgets/resource-finder' {
  const resourceFinder: import('@lp/platform-kit').UiModule;
  export default resourceFinder;
}

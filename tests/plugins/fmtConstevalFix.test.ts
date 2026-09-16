const {
  MARKER,
  disableFmtConsteval,
  injectIntoPodfile,
} = require('../../plugin.fmt.js') as {
  MARKER: string;
  disableFmtConsteval: (header: string) => string;
  injectIntoPodfile: (podfile: string) => string;
};

const EXPO_PODFILE = `target 'FieldService' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false
    )
  end
end
`;

const FMT_BASE_SNIPPET = `#elif defined(__apple_build_version__) && __apple_build_version__ < 14000029L
#  define FMT_USE_CONSTEVAL 0  // consteval is broken in Apple clang < 14.
#elif defined(__cpp_consteval)
#  define FMT_USE_CONSTEVAL 1
#elif FMT_GCC_VERSION >= 1002 || FMT_CLANG_VERSION >= 1101
#  define FMT_USE_CONSTEVAL 1
#else
#  define FMT_USE_CONSTEVAL 0
#endif
`;

describe('disableFmtConsteval', () => {
  it('turns FMT_USE_CONSTEVAL 1 into 0 and leaves existing 0 lines alone', () => {
    const patched = disableFmtConsteval(FMT_BASE_SNIPPET);
    expect(patched).toContain('#  define FMT_USE_CONSTEVAL 0  // consteval is broken');
    expect(patched.match(/FMT_USE_CONSTEVAL 1/g)).toBeNull();
    expect((patched.match(/FMT_USE_CONSTEVAL 0/g) || []).length).toBe(4);
  });

  it('is idempotent', () => {
    const once = disableFmtConsteval(FMT_BASE_SNIPPET);
    expect(disableFmtConsteval(once)).toBe(once);
  });
});

describe('injectIntoPodfile', () => {
  it('injects a post_install patch that rewrites fmt/base.h', () => {
    const next = injectIntoPodfile(EXPO_PODFILE);
    expect(next).toContain(MARKER);
    expect(next).toContain("installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h'");
    expect(next).toContain('FMT_USE_CONSTEVAL');
    expect(next).toContain('react_native_post_install');
  });

  it('does not inject twice', () => {
    const once = injectIntoPodfile(EXPO_PODFILE);
    expect(injectIntoPodfile(once)).toBe(once);
  });

  it('uses the post_install block parameter name', () => {
    const custom = EXPO_PODFILE.replace(
      'post_install do |installer|',
      'post_install do |pods|'
    );
    const next = injectIntoPodfile(custom);
    expect(next).toContain('pods.sandbox.root');
    expect(next).not.toContain('installer.sandbox.root');
  });

  it('throws when the Podfile has no post_install hook', () => {
    expect(() => injectIntoPodfile("target 'App' do\nend\n")).toThrow(/post_install/);
  });
});

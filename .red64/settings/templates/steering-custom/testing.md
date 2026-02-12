# Testing Standards

[Purpose: guide what to test, where tests live, and how to structure them]

## Philosophy
- Test behavior, not implementation
- Prefer fast, reliable tests; minimize brittle mocks
- Cover critical paths deeply; breadth over 100% pursuit

## Organization
Options:
- Co-located: `component.tsx` + `component.test.tsx`
- Separate: `/src/...` and `/tests/...`
Pick one as default; allow exceptions with rationale.

Naming:
- Files: `*.test.*` or `*.spec.*`
- Suites: what is under test; Cases: expected behavior

## Test Types
- Unit: single unit, mocked dependencies, very fast
- Integration: multiple units together, mock externals only
- E2E: full flows, minimal mocks, only for critical journeys

## Structure (AAA)
```typescript
it('does X when Y', () => {
  // Arrange
  const input = setup();
  // Act
  const result = act(input);
  // Assert
  expect(result).toEqual(expected);
});
```

## Mocking & Data
- Mock externals (API/DB); never mock the system under test
- Use factories/fixtures; reset state between tests
- Keep test data minimal and intention-revealing

## Coverage
- Target: [% overall]; higher for critical domains
- Enforce thresholds in CI; exceptions require review rationale

## Browser/E2E Test Configuration

Browser-based tests are prone to flakiness from popups, dialogs, and browser features interfering with test execution. Disable these proactively.

### Common Causes of Flaky Browser Tests
- **Password manager popups**: "Save password?" dialogs block interactions
- **Password leak detection**: Chrome checks passwords against breach databases
- **Autofill prompts**: Address/credit card autofill suggestions
- **Notification permission requests**: Browser-level permission dialogs
- **Browser updates/sync**: Background processes interfering with tests

### General Headless Chrome Settings

These settings apply across frameworks (Capybara, Playwright, Selenium, Puppeteer):

**Chrome Arguments** (command-line flags):
| Flag | Purpose |
|------|---------|
| `--headless=new` | Headless mode (new implementation) |
| `--disable-gpu` | Required for headless in some environments |
| `--no-sandbox` | Required in Docker/CI environments |
| `--disable-dev-shm-usage` | Avoid shared memory issues in containers |
| `--window-size=1400,900` | Consistent viewport for screenshots |
| `--disable-save-password-bubble` | Prevent "Save password?" popup |
| `--disable-features=PasswordLeakDetection,PasswordCheck,PasswordImport` | Disable password breach detection |
| `--disable-component-update` | Prevent Chrome component updates during tests |
| `--disable-sync` | Disable Chrome sync (prevents account popups) |
| `--disable-background-networking` | Disable background network requests |

**Chrome Preferences** (profile settings):
| Preference | Value | Purpose |
|------------|-------|---------|
| `credentials_enable_service` | `false` | Disable credential service |
| `profile.password_manager_enabled` | `false` | Disable password manager |
| `profile.password_manager_leak_detection` | `false` | Disable leak detection |
| `password_manager.leak_detection` | `false` | Alternate leak detection key |
| `profile.default_content_setting_values.notifications` | `2` | Block notification prompts |
| `autofill.profile_enabled` | `false` | Disable autofill |

### Network Isolation
- Block external HTTP requests while allowing localhost
- Prevents tests from depending on external services
- Catches unintended API calls to production endpoints

### JavaScript Framework Synchronization
- Wait for frontend frameworks (Stimulus, React, Vue) to hydrate before interacting
- Race conditions occur when tests interact before JS controllers are connected
- Implement helpers like `wait_for_stimulus_controller` or `waitForHydration`

---
_Focus on patterns and decisions. Tool-specific config lives elsewhere._

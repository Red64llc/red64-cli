# Authentication Patterns

Rails 8 built-in authentication using session-based auth with bcrypt password hashing.

---

## Philosophy

- **Session-based authentication**: Database-backed sessions, not JWTs
- **Secure by default**: httpOnly cookies, signed session IDs, rate limiting
- **Device tracking**: Sessions store IP address and user agent for security auditing
- **Simple model**: User has many Sessions; each login creates a new Session record

---

## Authentication Flow

```
1) User submits email + password to SessionsController#create
2) User.authenticate_by verifies credentials (bcrypt)
3) Server creates Session record with device info
4) Signed, permanent, httpOnly cookie stores session_id
5) Subsequent requests resume session via cookie lookup
6) Current.session provides request-scoped access to authenticated session/user
```

---

## Core Components

### Authentication Concern (`app/controllers/concerns/authentication.rb`)
- Included in `ApplicationController` - all controllers require auth by default
- `allow_unauthenticated_access` - opt-out for public actions
- `authenticated?` - helper method for views
- `Current.session` / `Current.user` - request-scoped user access

### Key Methods

| Method | Purpose |
|--------|---------|
| `require_authentication` | Before action, redirects to login if no session |
| `start_new_session_for(user)` | Creates session, sets cookie, tracks device |
| `terminate_session` | Destroys session, clears cookie |
| `after_authentication_url` | Return-to URL after login |

### Usage Pattern

```ruby
# Controller requiring authentication (default)
class ProjectsController < ApplicationController
  # All actions require auth automatically
end

# Controller with public actions
class PagesController < ApplicationController
  allow_unauthenticated_access only: %i[home about]
end

# Accessing current user
def index
  @projects = Current.user.projects
end

# Check in views
<% if authenticated? %>
  Welcome, <%= Current.user.email_address %>
<% end %>
```

---

## Session Management

### Session Model
- `belongs_to :user`
- Tracks `ip_address` and `user_agent` for security
- Destroyed on logout or password reset

### Session Cookie
- **Signed**: Tamper-proof via Rails signing
- **Permanent**: Long-lived (browser remembers)
- **httpOnly**: Not accessible to JavaScript
- **SameSite: Lax**: CSRF protection

### Multi-Device Sessions
Users can have multiple active sessions. Password reset destroys all sessions:

```ruby
@user.sessions.destroy_all  # Force re-login on all devices
```

---

## Password Management

### Password Storage
- `has_secure_password` with bcrypt (`bcrypt` gem)
- `password_digest` column stores hash
- Never store or log plaintext passwords

### Password Reset Flow
```
1) User requests reset via email
2) PasswordsMailer sends time-limited token
3) User clicks link with token
4) Token verified via find_by_password_reset_token!
5) Password updated, all sessions destroyed
```

### Rate Limiting
Login and password reset endpoints are rate-limited:
```ruby
rate_limit to: 10, within: 3.minutes, only: :create
```

---

## Extending Authentication

### Adding OAuth (Future)
When adding OAuth providers:
- Create `Identity` model linking external providers to User
- Use OmniAuth gem for provider strategies
- Keep session creation logic in Authentication concern

### Adding API Authentication (Future)
For API endpoints:
- Create `ApiToken` model with `authenticate_by_token` method
- Use separate controller concern for token auth
- Never mix cookie and token auth in same controller

### Adding MFA (Future)
For multi-factor authentication:
- Add `otp_secret` to User model
- Step-up verification for sensitive actions
- Consider WebAuthn for hardware key support

---

## Authorization (Not Yet Implemented)

Authentication verifies identity; authorization controls access. When adding:

### Recommended Pattern
```ruby
# Policy-based (e.g., Pundit)
authorize @project

# Or ownership checks
redirect_to root_path unless @project.user == Current.user
```

### Scoping Resources
```ruby
# Always scope to current user
def set_project
  @project = Current.user.projects.find(params[:id])
end
```

---

## Security Checklist

- [x] Passwords hashed with bcrypt
- [x] Session cookies httpOnly and signed
- [x] Rate limiting on login/reset endpoints
- [x] Device tracking (IP, user agent)
- [x] Session invalidation on password change
- [ ] Account lockout after failed attempts (implement as needed)
- [ ] Email verification (implement as needed)
- [ ] MFA support (implement as needed)

---

_Document patterns and extension points, not implementation details._

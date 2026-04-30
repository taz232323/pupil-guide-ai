## Problem

On mobile/tablet viewports (< 1024px), the sidebar in `DashboardShell` is hidden, and the mobile top bar only shows the logo, coins, and notification bell. The Sign Out button lives only in the sidebar, so mobile users have no way to sign out.

## Fix

Add a user menu to the mobile top bar in `src/components/DashboardShell.tsx`, placed next to the `NotificationBell`.

It will be a `DropdownMenu` triggered by the user's avatar (using the existing `StudentAvatar` component, size `sm`) with these items:

1. **Profile name + role** (header, non-clickable)
2. **Profile** — links to `/profile`
3. **Sign out** — calls `signOut()` from `useAuth`
4. **Delete account** — calls existing `handleDelete`, styled destructive

### Where

In `src/components/DashboardShell.tsx`, inside the mobile header block (the `lg:hidden` header around lines 169–191), append the avatar dropdown after `<NotificationBell />` in the right-side flex container.

### Components used

- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator` from `@/components/ui/dropdown-menu` (already in the project)
- `StudentAvatar` (already imported)
- `LogOut`, `User` icons from `lucide-react` (already imported)

### Out of scope

- Desktop header is unchanged — sign out remains in the sidebar there.
- No new routes or backend changes.

## Result

On any viewport, the user can tap their avatar in the top-right to access Profile, Sign out, and Delete account.

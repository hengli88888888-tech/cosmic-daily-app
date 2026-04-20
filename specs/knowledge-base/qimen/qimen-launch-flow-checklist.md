# Qimen Launch Flow Checklist

## Goal
Ship Qimen as the default first-touch experience:
- question first
- answer first
- birth details later

## Primary Flow
1. App opens into `/master-reply`.
2. User sees the Qimen calibration ritual before asking.
3. User submits one live concern.
4. Qimen loading state presents the resonance scan sequence.
5. Result page shows the revelation frame and 120-minute warning.
6. User may continue the same thread for low-cost follow-ups.
7. User may leave outcome feedback if invited.
8. User may add birth details after the result to unlock:
   - free daily suggestions
   - longer-range timing
   - more individualized chart-based guidance

## Guardrails
- Do not block first question behind profile creation.
- Do not auto-open an old thread when the user enters `/master-reply` without a `threadId`.
- Keep `/welcome` as a marketing landing page only.
- Keep `/onboarding` as an upgrade/edit step, not the default entry.
- Always return to the original Qimen thread after birth details are submitted from the upgrade card.

## Validation Points
- New user can ask immediately without entering birth details.
- Returning user opening the app lands on a clean ask screen, not a stale thread.
- Saved threads still open correctly from `/my-folder`.
- Feedback reward copy reflects dynamic reward bands instead of a hardcoded value.
- Birth-profile upgrade card appears only after a delivered Qimen answer.

## Current Status
- Default app entry moved to Qimen ask page.
- Welcome page downgraded to landing-page role.
- Post-answer birth-profile upgrade flow is active.
- Dynamic feedback reward copy is active in result and archive views.

# Daily Member Messages Deploy

This feature creates a daily in-app guidance message for subscribed members.

## Deploy

- Apply [schema.sql](/Users/liheng/Desktop/cosmic-daily-app/backend/schema.sql)
- Deploy:
  - [member-daily-messages/index.ts](/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/member-daily-messages/index.ts)
  - [daily-member-messages-fanout/index.ts](/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/daily-member-messages-fanout/index.ts)
  - [config.toml](/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/config.toml)

## Runtime behavior

- `Basic` members receive a brief daily message.
- `Advanced` members receive a deeper daily message.
- Messages are created for the member's local date.
- Messages expire after 3 days unless `is_favorited = true`.
- Messages are shown in [my_folder_screen.dart](/Users/liheng/Desktop/cosmic-daily-app/app/lib/screens/my_folder_screen.dart).

## Suggested schedule

Run [daily-member-messages-fanout/index.ts](/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/daily-member-messages-fanout/index.ts) once per day.

Recommended:
- `06:00 UTC` daily

This is only the batch creation job. Users also self-heal on open because [member-daily-messages/index.ts](/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/member-daily-messages/index.ts) will ensure today's message exists when they open the inbox.

## Validation

- Open `Saved Readings` as a subscribed user.
- Confirm a message exists for today's local date.
- Open it and confirm it marks as read.
- Bookmark it and confirm it remains after the normal 3-day retention window.

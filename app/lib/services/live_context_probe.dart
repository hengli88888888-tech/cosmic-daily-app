import 'live_context_types.dart';
import 'package:flutter_timezone/flutter_timezone.dart';

Future<LiveContextSnapshot> probeLiveContext() async {
  final submittedAt = DateTime.now().toIso8601String();
  String? timezone;

  try {
    final localTimezone = await FlutterTimezone.getLocalTimezone();
    if (localTimezone.trim().isNotEmpty) {
      timezone = localTimezone.trim();
    }
  } catch (_) {
    final fallbackTimezone = DateTime.now().timeZoneName.trim();
    if (fallbackTimezone.contains('/')) {
      timezone = fallbackTimezone;
    }
  }

  return LiveContextSnapshot(
    submittedAt: submittedAt,
    timezone: timezone,
  );
}

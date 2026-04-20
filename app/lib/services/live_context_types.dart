class LiveContextSnapshot {
  const LiveContextSnapshot({
    required this.submittedAt,
    this.timezone,
  });

  final String submittedAt;
  final String? timezone;
}

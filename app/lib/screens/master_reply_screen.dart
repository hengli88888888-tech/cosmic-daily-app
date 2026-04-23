import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_client.dart';
import '../services/live_context_probe.dart';
import '../theme/cosmic_theme.dart';

const _questionThreadsCacheKey = 'question_threads_cache';
const _masterReplyIntroSeenKey = 'master_reply_intro_seen_v1';

const List<({String value, String label})> _questionCategories = [
  (value: 'career_work', label: 'Work & career'),
  (value: 'money_wealth', label: 'Money & projects'),
  (value: 'love_relationship', label: 'Love & dating'),
  (value: 'marriage_family', label: 'Marriage & family'),
  (value: 'health_energy', label: 'Health'),
  (value: 'timing_decisions', label: 'Timing & choices'),
  (value: 'study_exams', label: 'School & exams'),
  (value: 'children_parenting', label: 'Kids & parenting'),
  (value: 'travel_relocation', label: 'Travel & moving'),
  (value: 'home_property', label: 'Home & property'),
  (value: 'other', label: 'Other'),
];

class MasterReplyScreen extends StatefulWidget {
  const MasterReplyScreen({super.key, this.initialThreadId});

  final String? initialThreadId;

  @override
  State<MasterReplyScreen> createState() => _MasterReplyScreenState();
}

class _MasterReplyScreenState extends State<MasterReplyScreen> {
  final _api = ApiClient();
  final _controller = TextEditingController();
  final _relationshipSelfBirthYearController = TextEditingController();
  final _relationshipPartnerBirthYearController = TextEditingController();
  static const _defaultDivinationSystem = 'qimen_yang';
  static const _defaultDivinationProfile = 'chai_bu';
  static const _qimenLoadingMessages = [
    'Scanning local temporal coordinates...',
    'Mapping gravitational flux patterns...',
    'Isolating relevant probability threads...',
    'Calculating the intersection of Time and Space...',
    'Harmonizing universal energy vectors...',
  ];

  String _category = '';
  final String _newTopicKind = 'deep';
  bool _loading = false;
  int? _coinBalance;
  bool _freeFirstQuestionAvailable = true;
  Map<String, dynamic>? _activeThread;
  List<Map<String, dynamic>> _threads = [];
  Timer? _loadingTimer;
  Timer? _introTimer;
  int _loadingMessageIndex = 0;
  String _birthProfileState = 'unknown';
  bool _birthProfileStateLoading = true;
  bool _showIntroSequence = false;
  int _visibleIntroSteps = 0;
  String _relationshipStatus = '';

  static const List<({String value, String label})> _relationshipStatuses = [
    (value: 'still_together', label: 'Still together'),
    (value: 'distant', label: 'Still together, but distant'),
    (value: 'on_and_off', label: 'On and off'),
    (value: 'recent_pullback', label: 'They recently pulled away'),
    (value: 'separated', label: 'Separated or close to ending'),
    (value: 'not_sure', label: 'Not sure'),
  ];

  Future<Map<String, dynamic>?> _resolveFeedbackStateForResponse(
    Map<String, dynamic> response,
  ) async {
    final divinationSystem =
        (response['divination_system'] ?? _defaultDivinationSystem).toString();
    final delivered = (response['status'] ?? '').toString() == 'delivered';
    final id = (response['id'] ?? '').toString();
    if (divinationSystem != 'qimen_yang' || !delivered || id.isEmpty) {
      return null;
    }
    try {
      final result = await _api.fetchMemberQimenFeedback(threadId: id);
      if (result['feedback_ready'] != true &&
          (result['feedback'] as Map?) == null) {
        return null;
      }
      final feedbackRow =
          Map<String, dynamic>.from((result['feedback'] as Map?) ?? const {});
      return {
        'available': result['feedback_ready'] == true || feedbackRow.isNotEmpty,
        'targetQuestionId': id,
        'rewardCoins': (result['reward_coins'] as num?)?.toInt() ?? 0,
        'submitted': feedbackRow.isNotEmpty,
        'verdict': feedbackRow['verdict'],
        'userFeedback': feedbackRow['user_feedback'],
        'updatedAt': feedbackRow['updated_at'],
        'rewardClaimed': result['reward_claimed'] == true,
        'rewardClaimedAt': result['reward_claimed_at'],
        'invitationReason': (result['invitation_reason'] ?? '').toString(),
        'invitationPolicy': Map<String, dynamic>.from(
          (result['invitation_policy'] as Map?) ?? const {},
        ),
      };
    } catch (_) {
      return null;
    }
  }

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void dispose() {
    _loadingTimer?.cancel();
    _introTimer?.cancel();
    _controller.dispose();
    _relationshipSelfBirthYearController.dispose();
    _relationshipPartnerBirthYearController.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    await _loadWallet();
    await _loadThreads();
    await _loadBirthProfileState();
    await _loadIntroState();
  }

  void _startQimenLoadingSequence() {
    _loadingTimer?.cancel();
    _loadingMessageIndex = 0;
    _loadingTimer = Timer.periodic(const Duration(milliseconds: 1500), (_) {
      if (!mounted || !_loading) return;
      setState(() {
        _loadingMessageIndex =
            (_loadingMessageIndex + 1) % _qimenLoadingMessages.length;
      });
    });
  }

  void _stopQimenLoadingSequence() {
    _loadingTimer?.cancel();
    _loadingTimer = null;
    _loadingMessageIndex = 0;
  }

  Future<void> _loadIntroState() async {
    if (_activeThread != null) return;
    final prefs = await SharedPreferences.getInstance();
    final seen = prefs.getBool(_masterReplyIntroSeenKey) ?? false;
    if (!mounted) return;

    if (seen) {
      setState(() {
        _showIntroSequence = true;
        _visibleIntroSteps = 3;
      });
      return;
    }

    setState(() {
      _showIntroSequence = true;
      _visibleIntroSteps = 0;
    });

    _introTimer?.cancel();
    _introTimer =
        Timer.periodic(const Duration(milliseconds: 1400), (timer) async {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_visibleIntroSteps >= 3) {
        timer.cancel();
        await prefs.setBool(_masterReplyIntroSeenKey, true);
        return;
      }
      setState(() {
        _visibleIntroSteps += 1;
      });
    });
  }

  Future<void> _loadWallet() async {
    try {
      final wallet = await _api.fetchWallet();
      if (!mounted) return;
      setState(() {
        _coinBalance = (wallet['balance'] as num?)?.toInt();
        _freeFirstQuestionAvailable =
            (wallet['freeFirstQuestionAvailable'] as bool?) ?? false;
      });
    } catch (_) {}
  }

  Future<void> _loadBirthProfileState() async {
    try {
      final result = await _api.fetchFirstImpression();
      if (!mounted) return;
      setState(() {
        _birthProfileState =
            (result['state'] as String?)?.trim().isNotEmpty == true
                ? (result['state'] as String).trim()
                : 'unknown';
        _birthProfileStateLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _birthProfileState = 'preparing_profile';
        _birthProfileStateLoading = false;
      });
    }
  }

  Future<void> _persistThreads(List<Map<String, dynamic>> threads) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _questionThreadsCacheKey,
      threads.map((item) => jsonEncode(item)).toList(),
    );
    if (threads.isEmpty) {
      await prefs.remove(_questionThreadsCacheKey);
    }
  }

  Map<String, dynamic> _buildMessage({
    required String id,
    required String role,
    required String kind,
    required String text,
    required String createdAt,
  }) {
    return {
      'id': id,
      'role': role,
      'kind': kind,
      'text': text,
      'createdAt': createdAt,
    };
  }

  Map<String, dynamic> _buildThreadFromResponse(
    Map<String, dynamic> response, {
    Map<String, dynamic>? baseThread,
    required String title,
    required String category,
    Map<String, dynamic>? feedbackState,
  }) {
    final id = (response['id'] ?? '').toString();
    final questionText = (response['question_text'] ?? title).toString();
    final answerText = (response['answer_text'] ?? '').toString();
    final createdAt =
        (response['created_at'] ?? DateTime.now().toIso8601String()).toString();
    final deliveredAt = (response['delivered_at'] ?? createdAt).toString();
    final questionKind = (response['question_kind'] ?? 'deep').toString();
    final coinCost = (response['coin_cost'] as num?)?.toInt() ?? 0;

    final messages = <Map<String, dynamic>>[
      ...((baseThread?['messages'] as List?) ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map)),
      _buildMessage(
        id: id,
        role: 'user',
        kind: questionKind,
        text: questionText,
        createdAt: createdAt,
      ),
      _buildMessage(
        id: '$id-reply',
        role: 'system',
        kind: 'answer',
        text: answerText,
        createdAt: deliveredAt,
      ),
    ];

    return {
      'id': ((response['parent_question_id'] ?? '').toString().isNotEmpty)
          ? (response['parent_question_id'] ?? '').toString()
          : id,
      'title': (baseThread?['title'] ?? title).toString(),
      'divinationSystem': (baseThread?['divinationSystem'] ??
              response['divination_system'] ??
              _defaultDivinationSystem)
          .toString(),
      'divinationProfile': (baseThread?['divinationProfile'] ??
              response['divination_profile'] ??
              _defaultDivinationProfile)
          .toString(),
      'category': (baseThread?['category'] ?? category).toString(),
      'status': 'delivered',
      'createdAt': (baseThread?['createdAt'] ?? createdAt).toString(),
      'updatedAt': deliveredAt,
      'lastCostLabel': questionKind == 'followup'
          ? (coinCost == 0 ? 'Free clarification' : '1 free coin')
          : coinCost == 2
              ? '2 free coins'
              : coinCost == 0
                  ? 'Free opening reading'
                  : '5 free coins',
      'feedback': feedbackState,
      'messages': messages,
    };
  }

  void _upsertThread(Map<String, dynamic> thread) {
    final threadId = (thread['id'] ?? '').toString();
    final next = <Map<String, dynamic>>[thread];
    for (final item in _threads) {
      if ((item['id'] ?? '').toString() != threadId) {
        next.add(item);
      }
    }
    _threads = next;
    _activeThread = thread;
    _persistThreads(_threads);
  }

  Future<List<Map<String, dynamic>>> _loadThreads({
    String? preferredThreadId,
  }) async {
    try {
      final items = await _api.fetchQuestionThreads();
      final activeId =
          (preferredThreadId ?? widget.initialThreadId ?? '').toString().trim();
      Map<String, dynamic>? activeThread;
      if (activeId.isNotEmpty) {
        for (final item in items) {
          if ((item['id'] ?? '').toString() == activeId) {
            activeThread = item;
            break;
          }
        }
      }

      if (!mounted) return items;
      setState(() {
        _threads = items;
        _activeThread = activeThread;
      });
      await _persistThreads(items);
      return items;
    } catch (_) {
      if (!mounted) return _threads;
      return _threads;
    }
  }

  Future<void> _submitNewTopic() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    final questionKind = _freeFirstQuestionAvailable ? 'deep' : _newTopicKind;
    final category = _category.isEmpty ? 'other' : _category;
    final requestId = DateTime.now().microsecondsSinceEpoch.toString();
    final liveContext = await probeLiveContext();
    final effectiveQuestion = _buildEffectiveQuestionText(text);

    setState(() => _loading = true);
    _startQimenLoadingSequence();
    try {
      final res = await _api.submitMasterQuestion(
        question: effectiveQuestion,
        category: category,
        questionKind: questionKind,
        requestId: requestId,
        divinationSystem: _defaultDivinationSystem,
        divinationProfile: _defaultDivinationProfile,
        submittedAt: liveContext.submittedAt,
        timezone: liveContext.timezone,
      );
      final feedbackState = await _resolveFeedbackStateForResponse(res);
      if (!mounted) return;
      setState(() {
        _coinBalance = (res['balance_after'] as num?)?.toInt() ?? _coinBalance;
        _controller.clear();
        _resetRelationshipSupplement();
        _upsertThread(
          _buildThreadFromResponse(
            res,
            title: text,
            category: category,
            feedbackState: feedbackState,
          ),
        );
        _loading = false;
      });
      await _loadWallet();
      await _loadThreads(preferredThreadId: (res['id'] ?? '').toString());
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      final message = e.toString();
      if (message.contains('INSUFFICIENT_COINS')) {
        context.push('/paywall');
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not send your question: $e')),
      );
    } finally {
      _stopQimenLoadingSequence();
    }
  }

  Future<void> _submitFollowup() async {
    final text = _controller.text.trim();
    final threadId = (_activeThread?['id'] ?? '').toString();
    if (text.isEmpty || threadId.isEmpty) return;
    final divinationSystem =
        (_activeThread?['divinationSystem'] ?? _defaultDivinationSystem)
            .toString();
    final divinationProfile =
        (_activeThread?['divinationProfile'] ?? _defaultDivinationProfile)
            .toString();
    final liveContext =
        divinationSystem == 'qimen_yang' ? await probeLiveContext() : null;

    setState(() => _loading = true);
    if (divinationSystem == 'qimen_yang') {
      _startQimenLoadingSequence();
    }
    try {
      final res = await _api.submitMasterQuestion(
        question: text,
        category: ((_activeThread?['category'] ?? '').toString().isNotEmpty
                ? (_activeThread?['category'] ?? '').toString()
                : (_category.isEmpty ? 'other' : _category))
            .toString(),
        questionKind: 'followup',
        parentQuestionId: threadId,
        requestId: DateTime.now().microsecondsSinceEpoch.toString(),
        divinationSystem: divinationSystem,
        divinationProfile:
            divinationSystem == 'qimen_yang' ? divinationProfile : null,
        submittedAt: liveContext?.submittedAt,
        timezone: liveContext?.timezone,
      );
      final feedbackState = await _resolveFeedbackStateForResponse(res);
      if (!mounted) return;
      final baseThread = _activeThread == null
          ? null
          : Map<String, dynamic>.from(_activeThread!);
      setState(() {
        _coinBalance = (res['balance_after'] as num?)?.toInt() ?? _coinBalance;
        _controller.clear();
        _upsertThread(
          _buildThreadFromResponse(
            res,
            baseThread: baseThread,
            title: (baseThread?['title'] ?? text).toString(),
            category: ((baseThread?['category'] ?? '').toString().isNotEmpty
                    ? (baseThread?['category'] ?? '').toString()
                    : (_category.isEmpty ? 'other' : _category))
                .toString(),
            feedbackState: feedbackState,
          ),
        );
        _loading = false;
      });
      await _loadWallet();
      await _loadThreads(
          preferredThreadId: (_activeThread?['id'] ?? '').toString());
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      final message = e.toString();
      if (message.contains('INSUFFICIENT_COINS')) {
        context.push('/paywall');
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not send follow-up: $e')),
      );
    } finally {
      _stopQimenLoadingSequence();
    }
  }

  Widget _qimenCalibrationCard() {
    final steps = [
      'Take a breath and focus on what you want to know.',
      'Keep it to one clear question.',
      'Type it below and start the reading.',
    ];
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F1FF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(steps.length, (index) {
          final visible = !_showIntroSequence || _visibleIntroSteps > index;
          return Padding(
            padding: EdgeInsets.only(bottom: index == steps.length - 1 ? 0 : 8),
            child: AnimatedOpacity(
              opacity: visible ? 1 : 0,
              duration: const Duration(milliseconds: 550),
              curve: Curves.easeOut,
              child: AnimatedSlide(
                duration: const Duration(milliseconds: 550),
                curve: Curves.easeOut,
                offset: visible ? Offset.zero : const Offset(0, 0.12),
                child: Text(
                  '${index + 1}. ${steps[index]}',
                  style:
                      const TextStyle(height: 1.45, color: CosmicPalette.fog),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _qimenResultFrame() {
    final thread = _activeThread;
    if (thread == null ||
        (thread['divinationSystem'] ?? '').toString() !=
            _defaultDivinationSystem) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF6EEFF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'The Field has responded. Here is the alignment for this moment.',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: CosmicPalette.ink,
            ),
          ),
          SizedBox(height: 10),
          Text(
            'Do not re-scan the same intent within the next 120 minutes. Trust the first resonance.',
            style: TextStyle(
              color: CosmicPalette.fog,
              height: 1.45,
            ),
          ),
          SizedBox(height: 10),
          Text(
            'The map is here. The movement is yours.',
            style: TextStyle(
              color: CosmicPalette.ocean,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  void _openBirthProfileUpgrade() {
    final threadId = (_activeThread?['id'] ?? '').toString();
    final query = <String, String>{
      'source': 'qimen-upgrade',
      if (threadId.isNotEmpty) 'threadId': threadId,
      if (_birthProfileState == 'verified_ready' ||
          _birthProfileState == 'needs_profile_rebuild')
        'mode': 'edit',
    };
    context.push(Uri(path: '/onboarding', queryParameters: query).toString());
  }

  Widget _birthProfileUpgradeCard() {
    final thread = _activeThread;
    if (thread == null ||
        (thread['divinationSystem'] ?? '').toString() !=
            _defaultDivinationSystem ||
        (thread['status'] ?? '').toString() != 'delivered') {
      return const SizedBox.shrink();
    }

    if (_birthProfileStateLoading) {
      return const SizedBox.shrink();
    }

    final profileReady = _birthProfileState == 'verified_ready';
    final profileNeedsRefresh = _birthProfileState == 'needs_profile_rebuild';

    final title = profileReady
        ? 'Your personal chart layer is active'
        : profileNeedsRefresh
            ? 'Refresh your birth details for deeper guidance'
            : 'Add birth details to unlock your personal chart';
    final body = profileReady
        ? 'Future readings can now layer in your personal chart for longer-range timing and more individualized guidance.'
        : profileNeedsRefresh
            ? 'Confirm your birth details once more to rebuild the personal chart layer behind your readings.'
            : 'Your Qimen answer is ready. Add birth details next to unlock the personal chart layer.';
    final ctaLabel =
        profileReady ? 'Update birth details' : 'Add birth details';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7EF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CosmicPalette.brass),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: const TextStyle(
              color: CosmicPalette.fog,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'This unlocks:',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: CosmicPalette.ink,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            '• Free daily suggestions',
            style: TextStyle(color: CosmicPalette.fog, height: 1.4),
          ),
          const SizedBox(height: 4),
          const Text(
            '• Longer-range timing',
            style: TextStyle(color: CosmicPalette.fog, height: 1.4),
          ),
          const SizedBox(height: 4),
          const Text(
            '• More individualized chart-based guidance',
            style: TextStyle(color: CosmicPalette.fog, height: 1.4),
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: _openBirthProfileUpgrade,
            child: Text(ctaLabel),
          ),
        ],
      ),
    );
  }

  Widget _qimenLoadingFrame() {
    if (!_loading ||
        ((_activeThread?['divinationSystem'] ?? _defaultDivinationSystem)
                .toString() !=
            _defaultDivinationSystem)) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F0FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'The Resonance',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: CosmicPalette.ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _qimenLoadingMessages[_loadingMessageIndex],
            style: const TextStyle(
              color: CosmicPalette.ocean,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Hold the original intent steady while the field settles.',
            style: TextStyle(
              color: CosmicPalette.fog,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _threadBubble(Map<String, dynamic> message) {
    final isUser = message['role'] == 'user';
    final isStructuredAnswer =
        !isUser && (message['kind'] ?? '').toString() == 'answer';
    final text = (message['text'] ?? '').toString();
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        constraints: const BoxConstraints(maxWidth: 316),
        decoration: BoxDecoration(
          color: isUser ? CosmicPalette.dusk : CosmicPalette.cream,
          borderRadius: BorderRadius.circular(18),
          border: isUser ? null : Border.all(color: CosmicPalette.line),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D1C1636),
              blurRadius: 14,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: isStructuredAnswer
            ? _structuredAnswerBody(
                text,
                hideShortAnswer: _activeThread != null,
              )
            : Text(
                text,
                style: TextStyle(
                  color: isUser ? Colors.white : CosmicPalette.ink,
                  height: 1.4,
                ),
              ),
      ),
    );
  }

  Widget _structuredAnswerBody(String text, {bool hideShortAnswer = false}) {
    final structured = _parseStructuredAnswer(text);
    final shortAnswer = structured.$1;
    final why = structured.$2;
    final action = structured.$3;

    if ((hideShortAnswer || shortAnswer == null) &&
        why == null &&
        action == null) {
      return Text(
        text,
        style: const TextStyle(
          color: CosmicPalette.ink,
          height: 1.45,
        ),
      );
    }

    Widget buildSection(String label, String value, {bool emphasize = false}) {
      return Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: emphasize ? const Color(0xFFF5F0FF) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: CosmicPalette.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: CosmicPalette.fog,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                color: CosmicPalette.ink,
                height: 1.4,
                fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!hideShortAnswer && shortAnswer != null)
          buildSection(
            'Short answer',
            shortAnswer,
            emphasize: true,
          ),
        if (why != null)
          buildSection(
            'Why',
            why,
          ),
        if (action != null)
          buildSection(
            'Action plan',
            action,
          ),
      ],
    );
  }

  (String?, String?, String?) _parseStructuredAnswer(String text) {
    final sections = text
        .split('\n\n')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    final shortAnswer = sections.cast<String?>().firstWhere(
          (item) => item != null && item.startsWith('Short answer:'),
          orElse: () => null,
        );
    final why = sections.cast<String?>().firstWhere(
          (item) => item != null && item.startsWith('Why:'),
          orElse: () => null,
        );
    final action = sections.cast<String?>().firstWhere(
          (item) => item != null && item.startsWith('Action plan:'),
          orElse: () => null,
        );
    return (
      shortAnswer?.replaceFirst('Short answer:', '').trim(),
      why?.replaceFirst('Why:', '').trim(),
      action?.replaceFirst('Action plan:', '').trim(),
    );
  }

  Widget _threadShortAnswerCard(List<Map<String, dynamic>> messages) {
    for (final message in messages.reversed) {
      final kind = (message['kind'] ?? '').toString();
      final role = (message['role'] ?? '').toString();
      if (role != 'system' || kind != 'answer') continue;
      final text = (message['text'] ?? '').toString();
      final shortAnswer = _parseStructuredAnswer(text).$1;
      if (shortAnswer == null || shortAnswer.isEmpty) continue;

      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF5F0FF),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: CosmicPalette.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Short answer',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: CosmicPalette.fog,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              shortAnswer,
              style: const TextStyle(
                color: CosmicPalette.ink,
                fontSize: 17,
                height: 1.3,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _threadHeader() {
    final thread = _activeThread;
    if (thread == null) return const SizedBox.shrink();
    final awaitingInfo =
        (thread['status'] ?? '').toString() == 'awaiting_user_info';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            CosmicPalette.brassSoft,
            Color(0xFFFFF2EC),
          ],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Current thread',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontSize: 12,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            (thread['title'] ?? '').toString(),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            awaitingInfo ? 'More detail needed' : 'Ongoing reading',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: CosmicPalette.ocean,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            awaitingInfo
                ? 'I need one more detail before I give you the strongest answer. Reply in this thread and that clarification will not cost an extra coin.'
                : 'Stay in this thread to go deeper into the same concern. A follow-up uses 1 free coin.',
            style: const TextStyle(height: 1.45, color: CosmicPalette.fog),
          ),
        ],
      ),
    );
  }

  Widget _composer() {
    final hasThread = _activeThread != null;
    final awaitingInfo =
        (_activeThread?['status'] ?? '').toString() == 'awaiting_user_info';
    final holdComposerForIntro =
        !hasThread && _showIntroSequence && _visibleIntroSteps < 3;
    final actionLabel = hasThread
        ? awaitingInfo
            ? 'Reply with details · free'
            : 'Continue this thread · 1 free coin'
        : _freeFirstQuestionAvailable
            ? 'Ask your free opening question'
            : _newTopicKind == 'quick'
                ? 'Start a new quick reading · 2 free coins'
                : 'Start a new deep reading · 5 free coins';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!hasThread && _showIntroSequence) ...[
          _qimenCalibrationCard(),
          if (!holdComposerForIntro) const SizedBox(height: 12),
        ] else ...[
          if (hasThread) ...[
            Text(
              awaitingInfo
                  ? 'Reply with the missing detail'
                  : 'Ask a follow-up about the same issue',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
          ],
        ],
        if (!holdComposerForIntro) ...[
          TextField(
            controller: _controller,
            onChanged: hasThread
                ? null
                : (_) {
                    setState(() {});
                  },
            minLines: 4,
            maxLines: 5,
            decoration: InputDecoration(
              alignLabelWithHint: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              labelText: hasThread ? 'Your follow-up' : 'Your question',
              hintStyle: const TextStyle(
                fontSize: 13,
                height: 1.35,
                color: CosmicPalette.fog,
              ),
              hintText: hasThread
                  ? awaitingInfo
                      ? 'Reply with the detail the system asked for.'
                      : 'Ask for more detail, timing, or clarification.'
                  : "e.g. Will I get this job offer after this interview?\nWill I get into this school this year?\nIs this relationship likely to continue over the next three months?\nShould I invest in this project right now?",
              border: const OutlineInputBorder(),
            ),
          ),
          if (!hasThread) ...[
            if (_shouldShowRelationshipSupplement()) ...[
              const SizedBox(height: 10),
              _relationshipSupplementCard(),
            ],
            const SizedBox(height: 8),
            const Text(
              'Topic (optional)',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: CosmicPalette.fog,
              ),
            ),
            const SizedBox(height: 4),
            DropdownButtonFormField<String>(
              initialValue: _category.isEmpty ? '' : _category,
              isExpanded: true,
              decoration: const InputDecoration(
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem<String>(
                  value: '',
                  child: Text('Select a topic'),
                ),
                ..._questionCategories.map(
                  (category) => DropdownMenuItem<String>(
                    value: category.value,
                    child: Text(
                      category.label,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
              onChanged: _loading
                  ? null
                  : (value) {
                      setState(() => _category = value ?? '');
                    },
            ),
          ],
          const SizedBox(height: 10),
          FilledButton(
            onPressed: _loading
                ? null
                : (hasThread ? _submitFollowup : _submitNewTopic),
            child: Text(
              _loading &&
                      ((_activeThread?['divinationSystem'] ??
                                  _defaultDivinationSystem)
                              .toString() ==
                          _defaultDivinationSystem)
                  ? 'Scanning...'
                  : _loading
                      ? 'Sending...'
                      : actionLabel,
            ),
          ),
          if (_loading &&
              ((_activeThread?['divinationSystem'] ?? _defaultDivinationSystem)
                      .toString() ==
                  _defaultDivinationSystem)) ...[
            const SizedBox(height: 12),
            _qimenLoadingFrame(),
          ],
          if (hasThread) ...[
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => setState(() {
                _activeThread = null;
                _resetRelationshipSupplement();
              }),
              child: const Text('Start a different topic'),
            ),
          ],
        ],
      ],
    );
  }

  bool _shouldShowRelationshipSupplement() {
    if (_activeThread != null) return false;
    final text = _controller.text.trim();
    if (text.isEmpty) return false;
    return _looksLikeThirdPartyRelationshipQuestion(text, _category);
  }

  bool _looksLikeThirdPartyRelationshipQuestion(String text, String category) {
    final sample = text.toLowerCase();
    final categoryLooksRelated =
        category == 'love_relationship' || category == 'marriage_family';
    final strongThirdPartySignal = RegExp(
      r'(affair|cheat|cheating|third party|someone else|other girl|other woman|other man|another girl|another woman|another man|seeing someone|with someone else|has something with|guy in (her|his) office|girl in (his|her) office|出轨|外遇|第三者|小三|暧昧对象|有别人)',
      caseSensitive: false,
    ).hasMatch(sample);
    return strongThirdPartySignal &&
        (categoryLooksRelated || sample.length >= 16);
  }

  String? _normalizedBirthYear(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (RegExp(r'^(19|20)\d{2}$').hasMatch(digits)) {
      return digits;
    }
    return null;
  }

  String? _relationshipStatusLabel(String value) {
    for (final option in _relationshipStatuses) {
      if (option.value == value) return option.label;
    }
    return null;
  }

  String _counterpartBirthYearLabel() {
    final sample = _controller.text.toLowerCase();
    if (RegExp(r'\b(wife|girlfriend|girl friend|her|she|女友|老婆|妻子)\b',
            caseSensitive: false)
        .hasMatch(sample)) {
      return 'Her birth year (optional)';
    }
    if (RegExp(r'\b(husband|boyfriend|boy friend|him|he|男友|老公|丈夫)\b',
            caseSensitive: false)
        .hasMatch(sample)) {
      return 'His birth year (optional)';
    }
    return 'Their birth year (optional)';
  }

  String _relationshipStatusFieldLabel() {
    final sample = _controller.text.toLowerCase();
    if (RegExp(
            r'\b(wife|husband|girlfriend|girl friend|boyfriend|boy friend|partner|wife|husband|老婆|妻子|女友|男友|老公|丈夫)\b',
            caseSensitive: false)
        .hasMatch(sample)) {
      return 'Current status between you two (optional)';
    }
    return 'Current relationship status (optional)';
  }

  String _buildEffectiveQuestionText(String originalText) {
    if (!_shouldShowRelationshipSupplement()) {
      return originalText;
    }

    final details = <String>[];
    final selfBirthYear =
        _normalizedBirthYear(_relationshipSelfBirthYearController.text);
    final partnerBirthYear =
        _normalizedBirthYear(_relationshipPartnerBirthYearController.text);
    final relationshipStatus = _relationshipStatusLabel(_relationshipStatus);

    if (selfBirthYear != null) {
      details.add('my birth year is $selfBirthYear');
    }
    if (partnerBirthYear != null) {
      details.add('his birth year is $partnerBirthYear');
    }
    if (relationshipStatus != null && relationshipStatus.isNotEmpty) {
      details.add('our current status is $relationshipStatus');
    }

    if (details.isEmpty) {
      return originalText;
    }

    return '$originalText\n\nRelationship context: ${details.join('. ')}.';
  }

  void _resetRelationshipSupplement() {
    _relationshipSelfBirthYearController.clear();
    _relationshipPartnerBirthYearController.clear();
    _relationshipStatus = '';
  }

  Widget _relationshipSupplementCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7EF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CosmicPalette.brass),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Optional detail for a more accurate relationship read',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: CosmicPalette.ink,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'If you know the birth year, add it. This can sharpen the reading, but it is not required.',
            style: TextStyle(
              color: CosmicPalette.fog,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _relationshipSelfBirthYearController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Your birth year (optional)',
              border: OutlineInputBorder(),
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _relationshipPartnerBirthYearController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: _counterpartBirthYearLabel(),
              border: const OutlineInputBorder(),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue:
                _relationshipStatus.isEmpty ? '' : _relationshipStatus,
            decoration: InputDecoration(
              labelText: _relationshipStatusFieldLabel(),
              border: const OutlineInputBorder(),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            items: [
              const DropdownMenuItem<String>(
                value: '',
                child: Text('Select a status'),
              ),
              ..._relationshipStatuses.map(
                (status) => DropdownMenuItem<String>(
                  value: status.value,
                  child: Text(status.label),
                ),
              ),
            ],
            onChanged: _loading
                ? null
                : (value) {
                    setState(() {
                      _relationshipStatus = value ?? '';
                    });
                  },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final threadMessages = ((_activeThread?['messages'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ask a question'),
        actions: [
          if (_coinBalance != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Text(
                  'Coins $_coinBalance',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: cosmicHeroDecoration(),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ask what matters now.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    height: 1.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (_activeThread != null) const SizedBox(height: 12),
          if (_activeThread != null) ...[
            _threadHeader(),
            const SizedBox(height: 14),
            _threadShortAnswerCard(threadMessages),
            if (threadMessages.isNotEmpty) const SizedBox(height: 12),
            _qimenResultFrame(),
            const SizedBox(height: 12),
            _birthProfileUpgradeCard(),
            if ((_activeThread?['divinationSystem'] ?? '').toString() ==
                _defaultDivinationSystem)
              const SizedBox(height: 12),
            ...threadMessages.map(_threadBubble),
            const SizedBox(height: 10),
          ],
          _composer(),
          if (_activeThread == null) ...[
            const SizedBox(height: 10),
            FilledButton.tonal(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFF1E9FF),
                foregroundColor: CosmicPalette.ink,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onPressed: () => context.push('/my-folder'),
              child: const Text('Saved Readings'),
            ),
          ],
          const SizedBox(height: 8),
          const Text(
            'For self-reflection only. Not medical, legal, financial, or emergency advice.',
            style: TextStyle(
              fontSize: 11,
              color: CosmicPalette.fog,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

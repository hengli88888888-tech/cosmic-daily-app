import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_client.dart';
import '../theme/cosmic_theme.dart';

class MyFolderScreen extends StatefulWidget {
  const MyFolderScreen({super.key});

  @override
  State<MyFolderScreen> createState() => _MyFolderScreenState();
}

class _MyFolderScreenState extends State<MyFolderScreen> {
  static const _threadsCacheKey = 'question_threads_cache';

  final _api = ApiClient();
  List<Map<String, dynamic>> _dailyMessages = [];
  List<Map<String, dynamic>> _threads = [];
  String _birthProfileState = 'unknown';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final threadRaw = prefs.getStringList(_threadsCacheKey) ?? [];

    final cachedThreads = <Map<String, dynamic>>[];
    for (final e in threadRaw) {
      try {
        cachedThreads.add(Map<String, dynamic>.from(jsonDecode(e) as Map));
      } catch (_) {}
    }

    List<Map<String, dynamic>> threads = cachedThreads;
    List<Map<String, dynamic>> dailyMessages = [];
    try {
      final remoteThreads = await _api.fetchQuestionThreads();
      if (remoteThreads.isNotEmpty) {
        threads = remoteThreads;
        await prefs.setStringList(
          _threadsCacheKey,
          remoteThreads.map((item) => jsonEncode(item)).toList(),
        );
      }
    } catch (_) {}

    try {
      dailyMessages = await _api.fetchMemberDailyMessages();
    } catch (_) {}

    try {
      final firstImpression = await _api.fetchFirstImpression();
      _birthProfileState =
          (firstImpression['state'] as String?)?.trim().isNotEmpty == true
              ? (firstImpression['state'] as String).trim()
              : 'unknown';
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _dailyMessages = dailyMessages;
      _threads = threads;
      _loading = false;
    });
  }

  Future<void> _toggleFavorite(Map<String, dynamic> item) async {
    final id = (item['id'] ?? '').toString();
    if (id.isEmpty) return;
    final current = item['is_favorited'] == true;
    await _api.toggleMemberDailyMessageFavorite(
      messageId: id,
      favorite: !current,
    );
    await _load();
  }

  Future<void> _openMessage(Map<String, dynamic> message) async {
    final id = (message['id'] ?? '').toString();
    if (id.isNotEmpty && message['is_read'] != true) {
      try {
        await _api.markMemberDailyMessageRead(messageId: id);
        if (mounted) {
          setState(() {
            _dailyMessages = _dailyMessages.map((item) {
              if ((item['id'] ?? '').toString() != id) return item;
              return {
                ...item,
                'is_read': true,
              };
            }).toList();
          });
        }
      } catch (_) {}
    }

    final body = Map<String, dynamic>.from(
      (message['body'] as Map?) ?? const {},
    );

    if (!mounted) return;
    await _showMessageSheet(message, body);

    if (mounted) {
      await _load();
    }
  }

  Future<void> _showMessageSheet(
    Map<String, dynamic> message,
    Map<String, dynamic> body,
  ) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        final entries = body.entries
            .where((entry) => entry.value != null)
            .map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.key.replaceAll('_', ' '),
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(entry.value.toString()),
                  ],
                ),
              ),
            )
            .toList();

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    (message['title'] ?? 'Daily message').toString(),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text((message['summary'] ?? '').toString()),
                  const SizedBox(height: 18),
                  ...entries,
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _feedbackVerdictLabel(String verdict) {
    switch (verdict) {
      case 'matched':
        return 'Matched';
      case 'partially_matched':
        return 'Partially matched';
      case 'missed':
        return 'Missed';
      default:
        return verdict;
    }
  }

  String? _threadShortAnswer(Map<String, dynamic> thread) {
    final messages = ((thread['messages'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    for (final message in messages.reversed) {
      final kind = (message['kind'] ?? '').toString();
      final role = (message['role'] ?? '').toString();
      if (role != 'system' || kind != 'answer') continue;
      final text = (message['text'] ?? '').toString();
      final sections = text
          .split('\n\n')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList();
      for (final section in sections) {
        if (section.startsWith('Short answer:')) {
          return section.replaceFirst('Short answer:', '').trim();
        }
      }
      if (text.trim().isNotEmpty) return text.trim();
    }
    return null;
  }

  List<Map<String, dynamic>> _sortedThreads() {
    final items =
        _threads.map((item) => Map<String, dynamic>.from(item)).toList();
    int feedbackRank(Map<String, dynamic> thread) {
      final feedback = Map<String, dynamic>.from(
        (thread['feedback'] as Map?) ?? const {},
      );
      if (feedback['available'] == true && feedback['submitted'] != true) {
        return 0;
      }
      if (feedback['submitted'] == true) {
        return 1;
      }
      return 2;
    }

    DateTime updatedAt(Map<String, dynamic> thread) {
      final raw = (thread['updatedAt'] ?? thread['createdAt'] ?? '').toString();
      return DateTime.tryParse(raw) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }

    items.sort((a, b) {
      final rankDiff = feedbackRank(a) - feedbackRank(b);
      if (rankDiff != 0) return rankDiff;
      return updatedAt(b).compareTo(updatedAt(a));
    });
    return items;
  }

  Future<void> _openFeedbackSheet({
    required String rootThreadId,
    required String targetQuestionId,
  }) async {
    Map<String, dynamic> feedbackState;
    try {
      feedbackState =
          await _api.fetchMemberQimenFeedback(threadId: targetQuestionId);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not load feedback: $error')),
      );
      return;
    }

    final rewardCoins = (feedbackState['reward_coins'] as num?)?.toInt() ?? 3;
    final feedbackRow = Map<String, dynamic>.from(
      (feedbackState['feedback'] as Map?) ?? const {},
    );
    final controller = TextEditingController(
      text: (feedbackRow['user_feedback'] ?? '').toString(),
    );
    String? selectedVerdict = (feedbackRow['verdict'] as String?)?.trim();
    bool submitting = false;
    final verdictOptions = <(String, String)>[
      ('matched', 'Matched'),
      ('partially_matched', 'Partially matched'),
      ('missed', 'Missed'),
    ];

    if (!mounted) return;
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  20,
                  20,
                  20,
                  20 + MediaQuery.of(context).viewInsets.bottom,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Outcome feedback',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Tell us what actually happened after the reading. A complete note returns $rewardCoins coins.',
                        style: const TextStyle(
                          color: CosmicPalette.fog,
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: verdictOptions.map((option) {
                          return ChoiceChip(
                            label: Text(option.$2),
                            selected: selectedVerdict == option.$1,
                            onSelected: submitting
                                ? null
                                : (_) => setModalState(
                                      () => selectedVerdict = option.$1,
                                    ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: controller,
                        minLines: 4,
                        maxLines: 8,
                        decoration: const InputDecoration(
                          labelText: 'What happened in real life?',
                          hintText:
                              'Describe the actual outcome, timing, and where the reading matched or missed.',
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Write at least 20 characters so the feedback is useful enough to learn from.',
                        style:
                            TextStyle(fontSize: 12, color: CosmicPalette.fog),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: submitting
                            ? null
                            : () async {
                                if (selectedVerdict == null) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Choose how the reading turned out first.',
                                      ),
                                    ),
                                  );
                                  return;
                                }
                                setModalState(() => submitting = true);
                                try {
                                  final response =
                                      await _api.submitMemberQimenFeedback(
                                    threadId: targetQuestionId,
                                    verdict: selectedVerdict!,
                                    userFeedback: controller.text.trim(),
                                  );
                                  if (!context.mounted) return;
                                  Navigator.of(context).pop(response);
                                } catch (error) {
                                  if (!context.mounted) return;
                                  setModalState(() => submitting = false);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Could not save feedback: $error',
                                      ),
                                    ),
                                  );
                                }
                              },
                        child: Text(
                          submitting
                              ? 'Saving...'
                              : 'Submit feedback · $rewardCoins coins back',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    if (result == null || !mounted) return;
    final nextFeedback = Map<String, dynamic>.from(
      (result['feedback'] as Map?) ?? const {},
    );
    final rewardClaimed = result['reward_claimed'] == true;
    final rewardCoinsAfterSubmit =
        (result['reward_coins'] as num?)?.toInt() ?? rewardCoins;

    setState(() {
      _threads = _threads.map((thread) {
        if ((thread['id'] ?? '').toString() != rootThreadId) return thread;
        return {
          ...thread,
          'feedback': {
            'available': true,
            'targetQuestionId': targetQuestionId,
            'rewardCoins': rewardCoinsAfterSubmit,
            'submitted': nextFeedback.isNotEmpty,
            'verdict': nextFeedback['verdict'],
            'userFeedback': nextFeedback['user_feedback'],
            'updatedAt': nextFeedback['updated_at'],
            'rewardClaimed': rewardClaimed,
            'rewardClaimedAt': nextFeedback['updated_at'],
          },
        };
      }).toList();
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          rewardClaimed
              ? 'Thanks for the feedback. $rewardCoinsAfterSubmit coins were returned to your wallet.'
              : 'Thanks for the feedback. Your note has been saved.',
        ),
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: Theme.of(context).textTheme.titleLarge),
    );
  }

  Widget _summaryCard({
    required String eyebrow,
    required String title,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            CosmicPalette.cream,
            Color(0xFFF6EEFF),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow,
            style: const TextStyle(
              color: CosmicPalette.ocean,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(height: 1.4, color: CosmicPalette.fog),
          ),
        ],
      ),
    );
  }

  Widget _birthDetailsCard() {
    final hasBirthDetails = _birthProfileState == 'verified_ready' ||
        _birthProfileState == 'needs_profile_rebuild';

    return Card(
      child: ListTile(
        leading: const Icon(Icons.edit_note_rounded),
        title: Text(
          hasBirthDetails
              ? 'Update your birth details for insight readings'
              : 'Add your birth details to unlock insight readings',
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push(
          hasBirthDetails ? '/onboarding?mode=edit' : '/onboarding',
        ),
      ),
    );
  }

  List<Map<String, dynamic>> _feedbackInboxItems() {
    return _threads.where((thread) {
      final feedback = Map<String, dynamic>.from(
        (thread['feedback'] as Map?) ?? const {},
      );
      return feedback['available'] == true &&
          feedback['submitted'] != true &&
          (feedback['targetQuestionId'] ?? '').toString().isNotEmpty;
    }).map((thread) {
      final feedback = Map<String, dynamic>.from(
        (thread['feedback'] as Map?) ?? const {},
      );
      final rewardCoins = (feedback['rewardCoins'] as num?)?.toInt() ?? 3;
      final threadTitle = (thread['title'] ?? 'Reading feedback').toString();
      final shortAnswer = _threadShortAnswer(thread);
      return {
        'threadId': (thread['id'] ?? '').toString(),
        'targetQuestionId': (feedback['targetQuestionId'] ?? '').toString(),
        'title': threadTitle,
        'summary':
            'Feedback requested · Return $rewardCoins coins by recording what actually happened.',
        'shortAnswer': shortAnswer,
        'rewardCoins': rewardCoins,
        'submitted': false,
        'verdict': (feedback['verdict'] ?? '').toString(),
      };
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final canGoBack = context.canPop();
    final feedbackInboxItems = _feedbackInboxItems();
    final sortedThreads = _sortedThreads();
    final unreadDailyMessages =
        _dailyMessages.where((message) => message['is_read'] != true).toList();
    final inboxCount = unreadDailyMessages.length + feedbackInboxItems.length;

    return Scaffold(
      appBar: AppBar(
        leading: canGoBack
            ? IconButton(
                onPressed: () => context.pop(),
                icon: const Icon(Icons.arrow_back_ios_new_rounded),
              )
            : null,
        title: const Text('Saved Readings'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: cosmicHeroDecoration(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'PRIVATE ARCHIVE',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.9,
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Pick up the threads and messages that still need attention.',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            height: 1.15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '$inboxCount messages • ${sortedThreads.length} conversations',
                          style: const TextStyle(
                            color: Color(0xFFD7CFF4),
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _summaryCard(
                          eyebrow: 'INBOX',
                          title: '$inboxCount saved messages',
                          subtitle: 'Unread notes and feedback requests.',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _summaryCard(
                          eyebrow: 'THREADS',
                          title: '${sortedThreads.length} active readings',
                          subtitle: 'Open threads and follow-ups.',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _birthDetailsCard(),
                  if (unreadDailyMessages.isNotEmpty ||
                      feedbackInboxItems.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    _sectionTitle(
                      context,
                      'Member messages (${feedbackInboxItems.length + unreadDailyMessages.length})',
                    ),
                    ...feedbackInboxItems.map(
                      (item) {
                        final previewParts = [
                          if ((item['shortAnswer'] ?? '')
                              .toString()
                              .trim()
                              .isNotEmpty)
                            (item['shortAnswer'] ?? '').toString(),
                          (item['summary'] ?? '').toString(),
                        ].where((part) => part.trim().isNotEmpty).toList();
                        return Card(
                          child: ListTile(
                            dense: true,
                            visualDensity: VisualDensity.compact,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 10,
                            ),
                            minLeadingWidth: 12,
                            leading: Container(
                              width: 10,
                              height: 10,
                              decoration: const BoxDecoration(
                                color: CosmicPalette.brass,
                                shape: BoxShape.circle,
                              ),
                            ),
                            title: Text(
                              (item['title'] ?? 'Outcome feedback available')
                                  .toString(),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                height: 1.2,
                              ),
                            ),
                            subtitle: previewParts.isEmpty
                                ? null
                                : Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      previewParts.first,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: CosmicPalette.fog,
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                            trailing: Text(
                              item['submitted'] == true
                                  ? _feedbackVerdictLabel(
                                      (item['verdict'] ?? '').toString(),
                                    )
                                  : '${item['rewardCoins']} coins',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: CosmicPalette.ocean,
                              ),
                            ),
                            onTap: () => _openFeedbackSheet(
                              rootThreadId: (item['threadId'] ?? '').toString(),
                              targetQuestionId:
                                  (item['targetQuestionId'] ?? '').toString(),
                            ),
                          ),
                        );
                      },
                    ),
                    ...unreadDailyMessages.map(
                      (message) => Card(
                        child: ListTile(
                          dense: true,
                          visualDensity: VisualDensity.compact,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          minLeadingWidth: 12,
                          leading: Container(
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(
                              color: CosmicPalette.brass,
                              shape: BoxShape.circle,
                            ),
                          ),
                          title: Text(
                            (message['title'] ?? 'Daily message').toString(),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              height: 1.2,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            [
                              (message['summary'] ?? '').toString(),
                              '${(message['message_date'] ?? '').toString()} • ${(message['variant'] ?? '').toString()}',
                            ]
                                .where((part) => part.trim().isNotEmpty)
                                .join(' · '),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: CosmicPalette.fog,
                              height: 1.3,
                            ),
                          ),
                          trailing: IconButton(
                            icon: Icon(
                              message['is_favorited'] == true
                                  ? Icons.bookmark
                                  : Icons.bookmark_border,
                            ),
                            onPressed: () => _toggleFavorite(message),
                          ),
                          onTap: () => _openMessage(message),
                        ),
                      ),
                    ),
                  ],
                  if (sortedThreads.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    _sectionTitle(
                      context,
                      'Active conversations (${sortedThreads.length})',
                    ),
                    ...sortedThreads.map(
                      (thread) {
                        final feedback = Map<String, dynamic>.from(
                          (thread['feedback'] as Map?) ?? const {},
                        );
                        final shortAnswer = _threadShortAnswer(thread);
                        final needsFeedback = feedback['available'] == true &&
                            feedback['submitted'] != true;
                        final feedbackSaved = feedback['submitted'] == true;
                        final subtitleParts = [
                          'Status: ${(thread['status'] ?? 'active').toString()} • ${(thread['lastCostLabel'] ?? 'Saved').toString()}',
                        ];

                        return Card(
                          child: ListTile(
                            dense: true,
                            visualDensity: VisualDensity.compact,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 10,
                            ),
                            leading: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: ((thread['divinationSystem'] ?? 'bazi')
                                            .toString() ==
                                        'qimen_yang')
                                    ? CosmicPalette.brassSoft
                                    : const Color(0xFFE7F0F6),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Icon(
                                ((thread['divinationSystem'] ?? 'bazi')
                                            .toString() ==
                                        'qimen_yang')
                                    ? Icons.explore_outlined
                                    : Icons.auto_awesome_outlined,
                                color: CosmicPalette.ink,
                              ),
                            ),
                            title: Text(
                              (thread['title'] ?? 'Conversation').toString(),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                height: 1.2,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (needsFeedback || feedbackSaved) ...[
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: needsFeedback
                                          ? CosmicPalette.brassSoft
                                          : const Color(0xFFEDE8FF),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      needsFeedback
                                          ? 'Needs feedback'
                                          : 'Feedback saved',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: needsFeedback
                                            ? CosmicPalette.ocean
                                            : CosmicPalette.ink,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                ],
                                if (shortAnswer != null &&
                                    shortAnswer.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    shortAnswer,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: CosmicPalette.ink,
                                      height: 1.35,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                ],
                                Text(
                                  subtitleParts.join(' · '),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: CosmicPalette.fog,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => context.push(
                              '/master-reply?threadId=${Uri.encodeComponent((thread['id'] ?? '').toString())}',
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                  const SizedBox(height: 18),
                  _sectionTitle(context, 'Notices'),
                  _summaryCard(
                    eyebrow: 'GOOD TO KNOW',
                    title:
                        'Coins stay available. Messages expire after 3 days.',
                    subtitle:
                        'Follow-ups cost less than starting over. Annual reports stay off until payment and delivery are verified.',
                  ),
                ],
              ),
            ),
    );
  }
}

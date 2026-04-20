import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/api_client.dart';
import '../services/share_service.dart';
import '../theme/cosmic_theme.dart';

class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _wallet;
  bool _loading = true;
  bool _sharing = false;
  int? _coinBalance;
  bool _freeFirstQuestionAvailable = false;
  int _unreadMemberMessages = 0;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await _loadWallet();
    await _loadMemberMessages();
    await _load();
  }

  void _routeToOnboardingIfMounted() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.go('/onboarding');
      }
    });
  }

  Future<void> _loadWallet() async {
    try {
      final wallet = await _api.fetchWallet();
      if (!mounted) return;
      setState(() {
        _wallet = wallet;
        _coinBalance = (wallet['balance'] as num?)?.toInt();
        _freeFirstQuestionAvailable =
            (wallet['freeFirstQuestionAvailable'] as bool?) ?? false;
      });
    } catch (_) {}
  }

  Future<void> _loadMemberMessages() async {
    try {
      final messages = await _api.fetchMemberDailyMessages();
      if (!mounted) return;
      setState(() {
        _unreadMemberMessages =
            messages.where((item) => item['is_read'] != true).length;
      });
    } catch (_) {}
  }

  Future<void> _load() async {
    try {
      final res = await _api.fetchFirstImpression();
      final state = (res['state'] as String?) ?? '';
      if (state == 'preparing_profile') {
        if (!mounted) return;
        _routeToOnboardingIfMounted();
        setState(() {
          _data = res;
          _loadError = null;
          _loading = false;
        });
        return;
      }
      if (!mounted) return;
      setState(() {
        _data = res;
        _loadError = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      _routeToOnboardingIfMounted();
      setState(() {
        _data = null;
        _loadError = error.toString();
        _loading = false;
      });
    }
  }

  bool get _isVerifiedReady => (_data?['state'] as String?) == 'verified_ready';

  String get _statusState =>
      (_data?['state'] as String?) ?? 'preparing_profile';

  List<Map<String, String>> _insights() {
    final structured = (_data?['top3Insights'] as List?)
            ?.map((item) => Map<String, dynamic>.from(item as Map))
            .toList() ??
        const [];
    return structured
        .map((item) => {
              'eyebrow': (item['eyebrow'] ?? '').toString(),
              'title': (item['title'] ?? '').toString(),
              'body': (item['body'] ?? '').toString(),
            })
        .toList();
  }

  Map<String, dynamic> _shareBonus() {
    final raw = (_wallet?['shareBonus'] as Map?) ?? const {};
    return Map<String, dynamic>.from(raw);
  }

  Future<void> _shareOraya() async {
    if (_sharing) return;
    setState(() => _sharing = true);
    try {
      final result = await ShareService.shareOraya(context);
      if (!mounted) return;
      if (result.status.name == 'dismissed') {
        setState(() => _sharing = false);
        return;
      }

      final reward = await _api.claimShareReward(
        channel: result.raw.isEmpty ? null : result.raw,
        shareResult: result.status.name,
        requestId: DateTime.now().microsecondsSinceEpoch.toString(),
      );
      await _loadWallet();
      if (!mounted) return;

      final rewarded = reward['rewarded'] == true;
      final rewardCoins = (reward['reward_coins'] as num?)?.toInt() ?? 0;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            rewarded
                ? 'Thanks for sharing Oraya. You earned $rewardCoins coins.'
                : 'Thanks for sharing Oraya. Your first-share bonus was already used.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open sharing right now: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _sharing = false);
      }
    }
  }

  Widget _insightCard(Map<String, String> item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: CosmicPalette.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D1C1636),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: CosmicPalette.brassSoft,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              item['eyebrow'] ?? '',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: CosmicPalette.ocean,
                letterSpacing: 0.6,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            item['title'] ?? '',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            item['body'] ?? '',
            style: const TextStyle(height: 1.55, color: CosmicPalette.fog),
          ),
        ],
      ),
    );
  }

  Widget _shareCard() {
    final shareBonus = _shareBonus();
    final claimed = (shareBonus['firstShareRewardClaimed'] as bool?) ?? false;
    final rewardCoins = (shareBonus['rewardCoins'] as num?)?.toInt() ?? 5;
    final totalShares = (shareBonus['totalShares'] as num?)?.toInt() ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFF2EC),
            CosmicPalette.brassSoft,
          ],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: CosmicPalette.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D1C1636),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Share Oraya',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: CosmicPalette.ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            claimed
                ? 'You can keep sharing Oraya anytime through Messages, WhatsApp, Instagram, Snapchat, or wherever you usually talk to people. Your first-share bonus is already unlocked.'
                : 'Share Oraya with a friend or to the apps you already use. Your first share unlocks $rewardCoins coins.',
            style: const TextStyle(
              height: 1.5,
              color: CosmicPalette.fog,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            totalShares == 0
                ? 'No shares yet.'
                : 'Shares recorded: $totalShares',
            style: const TextStyle(
              fontSize: 12,
              color: CosmicPalette.ocean,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _sharing ? null : _shareOraya,
            child: Text(
              _sharing
                  ? 'Opening share...'
                  : claimed
                      ? 'Share again'
                      : 'Share and unlock 5 coins',
            ),
          ),
        ],
      ),
    );
  }

  Widget _savedReadingsCard(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/my-folder'),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: CosmicPalette.dusk,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: CosmicPalette.line),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D1C1636),
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(
              Icons.mark_email_unread_outlined,
              color: Colors.white,
              size: 18,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _unreadMemberMessages > 0
                    ? 'You have $_unreadMemberMessages unread member message${_unreadMemberMessages == 1 ? '' : 's'}.'
                    : 'Open your saved readings and member messages.',
                style: const TextStyle(
                  color: Colors.white,
                  height: 1.35,
                ),
              ),
            ),
            if (_unreadMemberMessages > 0)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 9,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _unreadMemberMessages.toString(),
                  style: const TextStyle(
                    color: CosmicPalette.night,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _profileCorrectionPrompt(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'If this feels off, update your birth details',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: CosmicPalette.ink,
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => context.push('/onboarding?mode=edit'),
            child: const Text('Update birth details'),
          ),
        ],
      ),
    );
  }

  Widget _statusScreen(BuildContext context) {
    final title = ((_data?['title'] ?? '').toString().trim().isNotEmpty)
        ? (_data?['title'] ?? '').toString()
        : _loadError == null
            ? 'We’re still getting your reading ready'
            : 'Your first reading is not ready yet.';
    final body = ((_data?['body'] ?? '').toString().trim().isNotEmpty)
        ? (_data?['body'] ?? '').toString()
        : _loadError == null
            ? 'Oraya is still putting your first reading together.'
            : 'Oraya could not prepare your first reading just yet.';
    final ctaLabel = ((_data?['ctaLabel'] ?? '').toString().trim().isNotEmpty)
        ? (_data?['ctaLabel'] ?? '').toString()
        : 'Complete your profile';
    final ctaRoute = ((_data?['ctaRoute'] ?? '').toString().trim().isNotEmpty)
        ? (_data?['ctaRoute'] ?? '').toString()
        : '/onboarding';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: cosmicHeroDecoration(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _statusState == 'needs_profile_rebuild'
                      ? 'Profile update'
                      : 'First impression',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                body,
                style: const TextStyle(
                  color: Colors.white70,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 18),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: CosmicPalette.brass,
                  foregroundColor: CosmicPalette.night,
                ),
                onPressed: () => context.push(ctaRoute),
                child: Text(ctaLabel),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Card(
          child: ListTile(
            title: Text(
              _statusState == 'needs_profile_rebuild'
                  ? 'Why this needs one quick update'
                  : 'What happens next',
            ),
            subtitle: Text(
              _statusState == 'needs_profile_rebuild'
                  ? 'Your profile was created before Oraya finished using the verified version of this reading flow. Confirming your birth details one more time will rebuild it properly.'
                  : 'Once your profile is fully ready, your opening insights will show up here and you can keep going with a deeper question.',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(ctaRoute),
          ),
        ),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _readyScreen(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: cosmicHeroDecoration(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'First impression',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (_coinBalance != null)
                    Text(
                      'Coins $_coinBalance',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                (_data?['headline'] ?? '').toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                (_data?['theme'] ?? '').toString(),
                style: const TextStyle(
                  color: Color(0xFFD7CFF4),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 18),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: CosmicPalette.brass,
                  foregroundColor: CosmicPalette.night,
                ),
                onPressed: () => context.push('/master-reply'),
                child: Text(
                  _freeFirstQuestionAvailable
                      ? 'Ask the one thing on your mind'
                      : 'Go deeper now',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'Three things that stand out',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        ..._insights().map(_insightCard),
        const SizedBox(height: 6),
        _profileCorrectionPrompt(context),
        const SizedBox(height: 6),
        _savedReadingsCard(context),
        const SizedBox(height: 18),
        _shareCard(),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFFFF2EC),
                CosmicPalette.brassSoft,
              ],
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: CosmicPalette.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.auto_awesome, color: CosmicPalette.rust),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Next best move',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: CosmicPalette.ocean,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      (_data?['nextBestMove'] ?? '')
                              .toString()
                              .trim()
                              .isNotEmpty
                          ? (_data?['nextBestMove'] ?? '').toString()
                          : _freeFirstQuestionAvailable
                              ? 'Use your opening question on the part of life that feels most pressing right now.'
                              : 'When you want to go deeper, start with the part of life that feels the most active or unsettled.',
                      style: const TextStyle(
                        height: 1.4,
                        color: CosmicPalette.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: CosmicPalette.dusk,
            foregroundColor: Colors.white,
          ),
          onPressed: () => context.push('/paywall'),
          child: const Text('Open Coins & Membership'),
        ),
        const SizedBox(height: 10),
        Card(
          child: ListTile(
            leading: const Icon(Icons.notifications_active_outlined),
            title: const Text('Member messages'),
            subtitle: Text(
              _unreadMemberMessages > 0
                  ? 'Your latest member reading is waiting in Saved Readings.'
                  : 'Member readings show up in your archive and stay for 3 days unless you bookmark them.',
            ),
            trailing: _unreadMemberMessages > 0
                ? CircleAvatar(
                    radius: 12,
                    backgroundColor: CosmicPalette.dusk,
                    child: Text(
                      _unreadMemberMessages.toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  )
                : const Icon(Icons.chevron_right),
            onTap: () => context.push('/my-folder'),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: ListTile(
            title: const Text('Annual Insight Report'),
            subtitle: const Text(
              'This is still in preview. Payment and delivery will show up here once it is fully enabled.',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/annual-report'),
          ),
        ),
        const SizedBox(height: 80),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('First Impression')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : (_statusState == 'preparing_profile')
              ? const SizedBox.shrink()
              : _data == null || !_isVerifiedReady
              ? _statusScreen(context)
              : _readyScreen(context),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(12, 6, 12, 12),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => context.push('/my-folder'),
                icon: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.email_outlined),
                    if (_unreadMemberMessages > 0)
                      Positioned(
                        right: -6,
                        top: -6,
                        child: Container(
                          width: 16,
                          height: 16,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(
                            color: CosmicPalette.dusk,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            _unreadMemberMessages > 9
                                ? '9+'
                                : _unreadMemberMessages.toString(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                label: const Text('Saved Readings'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: CosmicPalette.dusk,
                  foregroundColor: Colors.white,
                ),
                onPressed: () => context.push('/master-reply'),
                icon: const Icon(Icons.auto_awesome),
                label: const Text('Ask Now'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

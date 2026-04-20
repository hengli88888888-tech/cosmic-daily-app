import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/api_client.dart';
import '../services/revenuecat_service.dart';
import '../services/share_service.dart';
import '../theme/cosmic_theme.dart';

class PaywallScreen extends StatefulWidget {
  const PaywallScreen({super.key});

  @override
  State<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends State<PaywallScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _wallet;
  RevenueCatCatalog? _catalog;
  bool _loading = true;
  bool _restoring = false;
  bool _sharing = false;
  String? _purchasingIdentifier;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      await _api.ensureSignedIn();
      final wallet = await _api.fetchWallet();
      final catalog = await RevenueCatService.instance.loadCatalog();
      if (!mounted) return;
      setState(() {
        _wallet = wallet;
        _catalog = catalog;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _catalog = const RevenueCatCatalog(
          available: false,
          reason: 'Purchases are not available in this build yet.',
          products: {},
        );
        _loading = false;
      });
    }
  }

  Future<void> _purchase(RevenueCatProduct product) async {
    setState(() => _purchasingIdentifier = product.identifier);
    try {
      await RevenueCatService.instance.purchasePackage(product.package);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Purchase received for ${product.title}. Your balance and membership will refresh shortly.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            RevenueCatService.instance.describeError(error),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _purchasingIdentifier = null);
      }
    }
  }

  Future<void> _restore() async {
    setState(() => _restoring = true);
    try {
      await RevenueCatService.instance.restorePurchases();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Restore requested. If purchases exist for this account, your membership will refresh shortly.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            RevenueCatService.instance.describeError(error),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _restoring = false);
      }
    }
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
      await _load();
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
        SnackBar(
          content: Text('Could not open sharing right now: $error'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _sharing = false);
      }
    }
  }

  Widget _planCard({
    required String name,
    required String price,
    required String coins,
    required String detail,
    RevenueCatProduct? product,
    bool featured = false,
  }) {
    final canPurchase = product != null;
    final isPurchasing =
        product != null && _purchasingIdentifier == product.identifier;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: featured
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  CosmicPalette.night,
                  Color(0xFF2A2052),
                  Color(0xFF4A3B7F),
                ],
              )
            : const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  CosmicPalette.cream,
                  Color(0xFFF6EEFF),
                ],
              ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: featured ? CosmicPalette.brass : CosmicPalette.line,
          width: featured ? 1.5 : 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x121C1636),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: featured ? Colors.white : CosmicPalette.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            canPurchase ? product.priceLabel : price,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: featured ? Colors.white : CosmicPalette.ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            coins,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: featured ? CosmicPalette.brassSoft : CosmicPalette.ocean,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            detail,
            style: TextStyle(
              height: 1.4,
              color: featured ? const Color(0xFFD7CFF4) : CosmicPalette.fog,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: canPurchase
                  ? (featured ? CosmicPalette.brass : CosmicPalette.ink)
                  : CosmicPalette.mist,
              foregroundColor: canPurchase
                  ? (featured ? CosmicPalette.ink : Colors.white)
                  : const Color(0xFF66708C),
            ),
            onPressed:
                canPurchase && !isPurchasing ? () => _purchase(product) : null,
            child: Text(
              isPurchasing
                  ? 'Processing...'
                  : canPurchase
                      ? 'Start now'
                      : 'Unavailable in this build',
            ),
          ),
        ],
      ),
    );
  }

  Widget _shopCard({
    required String title,
    required String subtitle,
    RevenueCatProduct? product,
  }) {
    final canPurchase = product != null;
    final isPurchasing =
        product != null && _purchasingIdentifier == product.identifier;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
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
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: CosmicPalette.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(height: 1.4, color: CosmicPalette.fog),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed:
                canPurchase && !isPurchasing ? () => _purchase(product) : null,
            child: Text(
              isPurchasing
                  ? 'Processing...'
                  : canPurchase
                      ? 'Buy now'
                      : 'Unavailable in this build',
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canGoBack = context.canPop();
    final balance = (_wallet?['balance'] as num?)?.toInt() ?? 0;
    final freeFirstQuestionAvailable =
        (_wallet?['freeFirstQuestionAvailable'] as bool?) ?? false;
    final shareBonus = Map<String, dynamic>.from(
      (_wallet?['shareBonus'] as Map?) ?? const {},
    );
    final shareClaimed =
        (shareBonus['firstShareRewardClaimed'] as bool?) ?? false;
    final catalog = _catalog;
    final purchaseNote = catalog?.reason;

    return Scaffold(
      appBar: AppBar(
        leading: canGoBack
            ? IconButton(
                onPressed: () => context.pop(),
                icon: const Icon(Icons.arrow_back_ios_new_rounded),
              )
            : null,
        title: const Text('Coins & Membership'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: cosmicHeroDecoration(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'MEMBERSHIP',
                          style: TextStyle(
                            color: Color(0xFFD7CFF4),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.9,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Keep the conversation going.',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          height: 1.15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Coins never expire. Use them for deep readings, quick answers, and low-cost follow-ups in the same thread.',
                        style: TextStyle(
                          color: Color(0xFFD7CFF4),
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Current balance',
                              style: TextStyle(color: Color(0xFFD7CFF4)),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '$balance coins',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (purchaseNote != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          purchaseNote,
                          style: const TextStyle(
                            color: Color(0xFFD7CFF4),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 18),
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
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: CosmicPalette.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'How coins work',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: CosmicPalette.ocean,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text('Deep reading · 5 coins'),
                      const Text('Quick answer · 2 coins'),
                      const Text('Follow-up in the same thread · 1 coin'),
                      const SizedBox(height: 8),
                      Text(
                        freeFirstQuestionAvailable
                            ? 'Your opening deep question is still available, so you can experience the flow before deciding to upgrade.'
                            : 'Your opening question has already been used. Use coins to keep the conversation moving across new topics and follow-ups.',
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: CosmicPalette.fog,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
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
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: CosmicPalette.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Share Oraya',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: CosmicPalette.ocean,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        shareClaimed
                            ? 'Your first-share bonus is already unlocked. You can still share Oraya through Messages, WhatsApp, Instagram, Snapchat, or any app in your system share sheet.'
                            : 'Your first share unlocks 5 coins. After that, you can still share Oraya anytime, but the bonus only happens once.',
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.45,
                          color: CosmicPalette.fog,
                        ),
                      ),
                      const SizedBox(height: 12),
                      FilledButton.tonal(
                        onPressed: _sharing ? null : _shareOraya,
                        child: Text(
                          _sharing
                              ? 'Opening share...'
                              : shareClaimed
                                  ? 'Share again'
                                  : 'Share and unlock 5 coins',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Membership',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                _planCard(
                  name: 'Basic',
                  price: '\$7.99 / month',
                  coins: '20 coins every week',
                  detail:
                      'Good if you want a steady amount of guidance and occasional deep readings.',
                  product: catalog?[RevenueCatProductKind.basicMonthly],
                ),
                _planCard(
                  name: 'Advanced',
                  price: '\$19.99 / month',
                  coins: '70 coins every week',
                  detail:
                      'Built for daily use, deeper follow-up, and multiple live questions across the week.',
                  featured: true,
                  product: catalog?[RevenueCatProductKind.proMonthly],
                ),
                _planCard(
                  name: 'Advanced Yearly',
                  price: '\$199 / year',
                  coins: '70 coins every week',
                  detail:
                      'Best long-term value if you plan to use the app as an ongoing personal guidance tool.',
                  product: catalog?[RevenueCatProductKind.proYearly],
                ),
                const SizedBox(height: 12),
                const Text(
                  'Coin packs',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                _shopCard(
                  title: '5 coins · \$2.99',
                  subtitle: 'A light top-up for a single deep reading.',
                  product: catalog?[RevenueCatProductKind.coins5Pack],
                ),
                _shopCard(
                  title: '15 coins · \$6.99',
                  subtitle:
                      'A flexible pack for several quick answers or a few follow-ups.',
                  product: catalog?[RevenueCatProductKind.coins15Pack],
                ),
                _shopCard(
                  title: '50 coins · \$19.99',
                  subtitle:
                      'Best if you want to unlock multiple new topics without committing to a plan yet.',
                  product: catalog?[RevenueCatProductKind.coins50Pack],
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _restoring ? null : _restore,
                  child:
                      Text(_restoring ? 'Restoring...' : 'Restore purchases'),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => context.canPop()
                      ? context.pop()
                      : context.go('/master-reply'),
                  child: const Text('Return to your question'),
                ),
              ],
            ),
    );
  }
}

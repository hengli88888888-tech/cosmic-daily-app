import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/cosmic_theme.dart';

class AuthUpgradeScreen extends StatefulWidget {
  const AuthUpgradeScreen({
    super.key,
    this.returnTo,
  });

  final String? returnTo;

  @override
  State<AuthUpgradeScreen> createState() => _AuthUpgradeScreenState();
}

class _AuthUpgradeScreenState extends State<AuthUpgradeScreen> {
  String get _returnRoute {
    final route = (widget.returnTo ?? '').trim();
    return route.isEmpty ? '/today' : route;
  }

  @override
  Widget build(BuildContext context) {
    final canGoBack = context.canPop();

    return Scaffold(
      appBar: AppBar(
        leading: canGoBack
            ? IconButton(
                onPressed: () => context.pop(),
                icon: const Icon(Icons.arrow_back_ios_new_rounded),
              )
            : null,
        title: const Text('Save your profile'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(22),
            decoration: cosmicHeroDecoration(),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ACCOUNT',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.9,
                  ),
                ),
                SizedBox(height: 12),
                Text(
                  'Save this profile and keep your insight readings',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    height: 1.12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 10),
                Text(
                  'Sign in once to keep your chart, reading history, and future daily suggestions tied to you.',
                  style: TextStyle(
                    color: Colors.white70,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const _BenefitCard(
            title: 'Why sign in',
            items: [
              'Keep your birth profile and insight readings on this device and future devices',
              'Save your thread history, feedback rewards, and coin balance',
              'Keep daily suggestions attached to your personal chart',
            ],
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => context.go(_returnRoute),
            child: const Text('Continue without sign-in'),
          ),
          const SizedBox(height: 8),
          const Text(
            'Account sign-in is coming later. For now, Oraya keeps your profile and readings attached to this app session.',
            style: TextStyle(
              fontSize: 12,
              height: 1.45,
              color: Color(0xFF4F5966),
            ),
          ),
        ],
      ),
    );
  }
}

class _BenefitCard extends StatelessWidget {
  const _BenefitCard({
    required this.title,
    required this.items,
  });

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7EF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '• $item',
                style: const TextStyle(
                  color: CosmicPalette.fog,
                  height: 1.45,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

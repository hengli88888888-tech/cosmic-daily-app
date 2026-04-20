import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AnnualReportScreen extends StatelessWidget {
  const AnnualReportScreen({super.key});

  void _showHoldNotice(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Annual reports are being prepared for release. Payment is not enabled in this build yet.',
        ),
      ),
    );
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
        title: const Text('Annual Insight Report'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF171C31), Color(0xFF364677)],
              ),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'A longer read for major transitions, yearly themes, and recurring patterns.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    height: 1.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 10),
                Text(
                  'This feature is being held until the payment flow and delivery pipeline are fully verified.',
                  style: TextStyle(
                    color: Colors.white70,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const Card(
            child: ListTile(
              title: Text('What it will include'),
              subtitle: Text(
                'Longer-range timing, relationship and career themes, risk windows, and a more complete written interpretation.',
              ),
            ),
          ),
          const Card(
            child: ListTile(
              title: Text('Current status'),
              subtitle: Text(
                'Preview only. Payment and fulfillment are intentionally disabled in this build.',
              ),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => _showHoldNotice(context),
            child: const Text('Not available yet'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () =>
                context.canPop() ? context.pop() : context.go('/today'),
            child: const Text('Back to First Impression'),
          ),
        ],
      ),
    );
  }
}

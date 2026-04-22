import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'screens/welcome_screen.dart';
import 'screens/auth_upgrade_screen.dart';
import 'screens/app_store_screenshot_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/today_screen.dart';
import 'screens/paywall_screen.dart';
import 'screens/master_reply_screen.dart';
import 'screens/annual_report_screen.dart';
import 'screens/my_folder_screen.dart';
import 'screens/chart_test_screen.dart';
import 'screens/first_impression_audit_screen.dart';
import 'screens/qimen_test_screen.dart';
import 'theme/cosmic_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  const appStoreScreenshotMode =
      bool.fromEnvironment('APP_STORE_SCREENSHOT_MODE');
  const configuredSupabaseUrl = String.fromEnvironment('SUPABASE_URL');
  const configuredSupabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  final isLocalWebPreview =
      kIsWeb && (Uri.base.host == '127.0.0.1' || Uri.base.host == 'localhost');
  final supabaseUrl = configuredSupabaseUrl.isNotEmpty
      ? configuredSupabaseUrl
      : (isLocalWebPreview ? 'http://127.0.0.1:54321' : '');
  final supabaseAnonKey = configuredSupabaseAnonKey.isNotEmpty
      ? configuredSupabaseAnonKey
      : (isLocalWebPreview
          ? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
          : '');

  runApp(
    OrayaBootstrapApp(
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
      skipSupabaseBootstrap: appStoreScreenshotMode,
    ),
  );
}

class OrayaBootstrapApp extends StatefulWidget {
  const OrayaBootstrapApp({
    super.key,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.skipSupabaseBootstrap,
  });

  final String supabaseUrl;
  final String supabaseAnonKey;
  final bool skipSupabaseBootstrap;

  @override
  State<OrayaBootstrapApp> createState() => _OrayaBootstrapAppState();
}

class _OrayaBootstrapAppState extends State<OrayaBootstrapApp> {
  late final Future<void> _bootstrapFuture = _bootstrap();

  Future<void> _bootstrap() async {
    if (widget.skipSupabaseBootstrap) {
      return;
    }

    if (widget.supabaseUrl.isEmpty || widget.supabaseAnonKey.isEmpty) {
      throw StateError(
        'Supabase configuration is missing. Provide SUPABASE_URL and SUPABASE_ANON_KEY for this build.',
      );
    }

    await Supabase.initialize(
      url: widget.supabaseUrl,
      anonKey: widget.supabaseAnonKey,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Oraya',
      debugShowCheckedModeBanner: false,
      theme: buildCosmicTheme(),
      home: FutureBuilder<void>(
        future: _bootstrapFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const _BootstrapStatusScreen(
              title: 'Preparing Oraya',
              body:
                  'Connecting to the guidance engine and restoring your session.',
              showSpinner: true,
            );
          }

          if (snapshot.hasError) {
            return _BootstrapStatusScreen(
              title: 'Startup blocked',
              body: snapshot.error.toString(),
            );
          }

          return const OrayaApp();
        },
      ),
    );
  }
}

class _BootstrapStatusScreen extends StatelessWidget {
  const _BootstrapStatusScreen({
    required this.title,
    required this.body,
    this.showSpinner = false,
  });

  final String title;
  final String body;
  final bool showSpinner;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: cosmicHeroDecoration(),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (showSpinner) ...[
                      const SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.6,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                    ],
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      body,
                      style: const TextStyle(
                        color: Color(0xFFD7CFF4),
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class OrayaApp extends StatelessWidget {
  const OrayaApp({super.key});

  CustomTransitionPage<void> _animatedPage(GoRouterState state, Widget child) {
    return CustomTransitionPage<void>(
      key: state.pageKey,
      child: child,
      transitionDuration: const Duration(milliseconds: 360),
      reverseTransitionDuration: const Duration(milliseconds: 260),
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        final curved =
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
        final slide =
            Tween<Offset>(begin: const Offset(0.03, 0.02), end: Offset.zero)
                .animate(curved);
        final fade = Tween<double>(begin: 0, end: 1).animate(curved);
        return FadeTransition(
          opacity: fade,
          child: SlideTransition(position: slide, child: child),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    const appStoreScreenshotMode =
        bool.fromEnvironment('APP_STORE_SCREENSHOT_MODE');
    const appStoreScreenshotPage =
        int.fromEnvironment('APP_STORE_SCREENSHOT_PAGE');
    const appStoreScreenshotAutoPlay =
        bool.fromEnvironment('APP_STORE_SCREENSHOT_AUTOPLAY');
    final router = GoRouter(
      initialLocation:
          appStoreScreenshotMode ? '/app-store-screenshot' : '/master-reply',
      routes: [
        GoRoute(
          path: '/app-store-screenshot',
          pageBuilder: (_, state) => _animatedPage(
            state,
            const AppStoreScreenshotScreen(
              pageIndex: appStoreScreenshotPage,
              autoPlay: appStoreScreenshotAutoPlay,
            ),
          ),
        ),
        GoRoute(
          path: '/welcome',
          pageBuilder: (_, state) =>
              _animatedPage(state, const WelcomeScreen()),
        ),
        GoRoute(
          path: '/onboarding',
          pageBuilder: (_, state) => _animatedPage(
            state,
            OnboardingScreen(
              mode: state.uri.queryParameters['mode'],
              source: state.uri.queryParameters['source'],
              threadId: state.uri.queryParameters['threadId'],
            ),
          ),
        ),
        GoRoute(
          path: '/auth-upgrade',
          pageBuilder: (_, state) => _animatedPage(
            state,
            AuthUpgradeScreen(
              returnTo: state.uri.queryParameters['returnTo'],
            ),
          ),
        ),
        GoRoute(
          path: '/today',
          pageBuilder: (_, state) => _animatedPage(state, const TodayScreen()),
        ),
        GoRoute(
          path: '/paywall',
          pageBuilder: (_, state) =>
              _animatedPage(state, const PaywallScreen()),
        ),
        GoRoute(
          path: '/master-reply',
          pageBuilder: (_, state) => _animatedPage(
            state,
            MasterReplyScreen(
              initialThreadId: state.uri.queryParameters['threadId'],
            ),
          ),
        ),
        GoRoute(
          path: '/my-folder',
          pageBuilder: (_, state) =>
              _animatedPage(state, const MyFolderScreen()),
        ),
        GoRoute(
          path: '/annual-report',
          pageBuilder: (_, state) =>
              _animatedPage(state, const AnnualReportScreen()),
        ),
        GoRoute(
          path: '/chart-test',
          pageBuilder: (_, state) =>
              _animatedPage(state, const ChartTestScreen()),
        ),
        GoRoute(
          path: '/first-impression-audit',
          pageBuilder: (_, state) =>
              _animatedPage(state, const FirstImpressionAuditScreen()),
        ),
        GoRoute(
          path: '/qimen-test',
          pageBuilder: (_, state) =>
              _animatedPage(state, const QimenTestScreen()),
        ),
      ],
    );

    return MaterialApp.router(
      title: 'Oraya',
      debugShowCheckedModeBanner: false,
      theme: buildCosmicTheme(),
      routerConfig: router,
    );
  }
}

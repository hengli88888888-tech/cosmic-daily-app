import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

enum RevenueCatProductKind {
  basicMonthly,
  proMonthly,
  proYearly,
  coins5Pack,
  coins15Pack,
  coins50Pack,
}

class RevenueCatProduct {
  const RevenueCatProduct({
    required this.kind,
    required this.package,
  });

  final RevenueCatProductKind kind;
  final Package package;

  String get identifier => package.storeProduct.identifier;
  String get priceLabel => package.storeProduct.priceString;
  String get title => package.storeProduct.title;
}

class RevenueCatCatalog {
  const RevenueCatCatalog({
    required this.available,
    required this.reason,
    required this.products,
  });

  final bool available;
  final String? reason;
  final Map<RevenueCatProductKind, RevenueCatProduct> products;

  RevenueCatProduct? operator [](RevenueCatProductKind kind) => products[kind];
}

class RevenueCatService {
  RevenueCatService._();

  static final instance = RevenueCatService._();

  bool _configured = false;
  String? _configuredUserId;

  static const _appleApiKey = String.fromEnvironment(
    'REVENUECAT_APPLE_API_KEY',
  );
  static const _googleApiKey = String.fromEnvironment(
    'REVENUECAT_GOOGLE_API_KEY',
  );

  bool get isSupportedPlatform {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.android;
  }

  String? get unavailableReason {
    if (kIsWeb) {
      return 'Purchases are available in the iPhone and Android builds only.';
    }
    if (!isSupportedPlatform) {
      return 'Purchases are not enabled for this platform.';
    }
    if (_platformApiKey.isEmpty) {
      return 'RevenueCat keys are not configured for this build.';
    }
    return null;
  }

  String get _platformApiKey {
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return _appleApiKey;
      case TargetPlatform.android:
        return _googleApiKey;
      default:
        return '';
    }
  }

  Future<void> ensureConfigured() async {
    final reason = unavailableReason;
    if (reason != null) {
      throw StateError(reason);
    }

    final supabase = Supabase.instance.client;
    final user = supabase.auth.currentUser;
    if (user == null) {
      throw StateError(
          'A signed-in user is required before purchases can be configured.');
    }

    final userId = user.id;

    if (!_configured) {
      await Purchases.setLogLevel(LogLevel.warn);
      final configuration = PurchasesConfiguration(_platformApiKey)
        ..appUserID = userId;
      await Purchases.configure(configuration);
      _configured = true;
      _configuredUserId = userId;
      return;
    }

    if (_configuredUserId != userId) {
      await Purchases.logIn(userId);
      _configuredUserId = userId;
    }
  }

  Future<RevenueCatCatalog> loadCatalog() async {
    final reason = unavailableReason;
    if (reason != null) {
      return RevenueCatCatalog(
          available: false, reason: reason, products: const {});
    }

    await ensureConfigured();
    final offerings = await Purchases.getOfferings();
    final current = offerings.current;
    if (current == null) {
      return const RevenueCatCatalog(
        available: false,
        reason: 'No active RevenueCat offering is available for this build.',
        products: {},
      );
    }

    final products = <RevenueCatProductKind, RevenueCatProduct>{};
    for (final package in current.availablePackages) {
      final kind = _kindForPackage(package);
      if (kind == null) continue;
      products[kind] = RevenueCatProduct(kind: kind, package: package);
    }

    return RevenueCatCatalog(
      available: products.isNotEmpty,
      reason: products.isEmpty
          ? 'RevenueCat did not return the expected plan and coin-pack products.'
          : null,
      products: products,
    );
  }

  Future<CustomerInfo> purchasePackage(Package package) async {
    await ensureConfigured();
    final result = await Purchases.purchase(PurchaseParams.package(package));
    return result.customerInfo;
  }

  Future<CustomerInfo> restorePurchases() async {
    await ensureConfigured();
    return Purchases.restorePurchases();
  }

  String describeError(Object error) {
    if (error is PlatformException) {
      final code = PurchasesErrorHelper.getErrorCode(error);
      if (code == PurchasesErrorCode.purchaseCancelledError) {
        return 'Purchase cancelled.';
      }
      if (code == PurchasesErrorCode.configurationError) {
        return 'RevenueCat is not configured correctly for this build.';
      }
      if (error.message != null && error.message!.trim().isNotEmpty) {
        return error.message!.trim();
      }
    }
    return error.toString();
  }

  RevenueCatProductKind? _kindForPackage(Package package) {
    final candidates = <String>{
      package.identifier,
      package.storeProduct.identifier,
      package.storeProduct.title,
    }.map(_normalize).where((value) => value.isNotEmpty).toList();

    bool matches(List<String> aliases) {
      for (final candidate in candidates) {
        for (final alias in aliases) {
          if (candidate == alias || candidate.contains(alias)) {
            return true;
          }
        }
      }
      return false;
    }

    if (matches(['basic_monthly', 'basic-monthly', 'basic monthly'])) {
      return RevenueCatProductKind.basicMonthly;
    }
    if (matches([
      'pro_yearly',
      'advanced_yearly',
      'advanced yearly',
      'annual',
      'yearly',
      'pro-annual',
    ])) {
      return RevenueCatProductKind.proYearly;
    }
    if (matches([
      'pro_monthly',
      'advanced_monthly',
      'advanced monthly',
      'pro monthly',
      'advanced',
    ])) {
      return RevenueCatProductKind.proMonthly;
    }
    if (matches(['coins_5_pack', 'coins-5', '5_coins', '5 coins'])) {
      return RevenueCatProductKind.coins5Pack;
    }
    if (matches(['coins_15_pack', 'coins-15', '15_coins', '15 coins'])) {
      return RevenueCatProductKind.coins15Pack;
    }
    if (matches(['coins_50_pack', 'coins-50', '50_coins', '50 coins'])) {
      return RevenueCatProductKind.coins50Pack;
    }
    return null;
  }

  String _normalize(String value) =>
      value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();
}

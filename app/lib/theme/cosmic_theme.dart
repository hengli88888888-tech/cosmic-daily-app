import 'package:flutter/material.dart';

class CosmicPalette {
  static const ink = Color(0xFF1C1636);
  static const night = Color(0xFF120F28);
  static const ocean = Color(0xFF2C2356);
  static const dusk = Color(0xFF5C4E8F);
  static const brass = Color(0xFFF7C9B6);
  static const brassSoft = Color(0xFFF2E7FF);
  static const paper = Color(0xFFF7F2FF);
  static const cream = Color(0xFFFCF9FF);
  static const mist = Color(0xFFE7DDF8);
  static const sage = Color(0xFF8173B8);
  static const rust = Color(0xFFD87F86);
  static const line = Color(0xFFD9D0EF);
  static const glow = Color(0xFFFFE3D6);
  static const fog = Color(0xFF766AA4);
}

ThemeData buildCosmicTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: CosmicPalette.brass,
    onPrimary: CosmicPalette.night,
    secondary: CosmicPalette.dusk,
    onSecondary: Colors.white,
    error: CosmicPalette.rust,
    onError: Colors.white,
    surface: CosmicPalette.paper,
    onSurface: CosmicPalette.ink,
  );

  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: CosmicPalette.paper,
    useMaterial3: true,
    fontFamily: 'SF Pro Text',
    appBarTheme: const AppBarTheme(
      backgroundColor: CosmicPalette.paper,
      foregroundColor: CosmicPalette.ink,
      elevation: 0,
      centerTitle: false,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(
        color: CosmicPalette.ink,
        fontSize: 28,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.6,
      ),
    ),
    cardTheme: const CardThemeData(
      elevation: 0,
      color: CosmicPalette.cream,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(22)),
        side: BorderSide(color: CosmicPalette.line),
      ),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: CosmicPalette.ink,
        fontSize: 34,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.8,
        height: 1.1,
      ),
      headlineMedium: TextStyle(
        color: CosmicPalette.ink,
        fontSize: 28,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.6,
        height: 1.14,
      ),
      titleLarge: TextStyle(
        color: CosmicPalette.ink,
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
      ),
      titleMedium: TextStyle(
        color: CosmicPalette.ink,
        fontSize: 17,
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: TextStyle(
        color: CosmicPalette.ink,
        fontSize: 16,
        height: 1.5,
      ),
      bodyMedium: TextStyle(
        color: CosmicPalette.fog,
        fontSize: 14,
        height: 1.5,
      ),
      labelLarge: TextStyle(
        color: CosmicPalette.ocean,
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.1,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(double.infinity, 54),
        backgroundColor: CosmicPalette.ink,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.1,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(double.infinity, 52),
        foregroundColor: CosmicPalette.ink,
        side: const BorderSide(color: CosmicPalette.line),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: CosmicPalette.ocean,
        textStyle: const TextStyle(
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      selectedColor: CosmicPalette.brassSoft,
      backgroundColor: CosmicPalette.cream,
      disabledColor: CosmicPalette.mist,
      side: const BorderSide(color: CosmicPalette.line),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
      ),
      labelStyle: const TextStyle(
        color: CosmicPalette.ink,
        fontWeight: FontWeight.w600,
      ),
      secondaryLabelStyle: const TextStyle(
        color: CosmicPalette.ink,
        fontWeight: FontWeight.w700,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: CosmicPalette.cream,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: const TextStyle(color: CosmicPalette.fog),
      labelStyle: const TextStyle(color: CosmicPalette.ocean),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: CosmicPalette.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: CosmicPalette.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: CosmicPalette.brass, width: 1.4),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: CosmicPalette.rust),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: CosmicPalette.ink,
      contentTextStyle: const TextStyle(
        color: Colors.white,
        height: 1.4,
      ),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: CosmicPalette.line,
      space: 1,
      thickness: 1,
    ),
  );
}

BoxDecoration cosmicHeroDecoration() {
  return BoxDecoration(
    borderRadius: BorderRadius.circular(28),
    gradient: const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        CosmicPalette.night,
        Color(0xFF241B4D),
        Color(0xFF403175),
      ],
    ),
    boxShadow: const [
      BoxShadow(
        color: Color(0x26120F28),
        blurRadius: 32,
        offset: Offset(0, 14),
      ),
    ],
  );
}

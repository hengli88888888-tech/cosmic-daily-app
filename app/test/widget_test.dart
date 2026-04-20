import 'package:flutter_test/flutter_test.dart';

import 'package:cosmic_daily_app/screens/welcome_screen.dart';
import 'package:flutter/material.dart';

void main() {
  testWidgets('welcome screen renders question-first CTA',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: WelcomeScreen(),
      ),
    );

    expect(find.text('Ask your question now'), findsOneWidget);
  });
}

import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/cosmic_theme.dart';

class AppStoreScreenshotScreen extends StatelessWidget {
  const AppStoreScreenshotScreen({
    super.key,
    required this.pageIndex,
    required this.autoPlay,
  });

  final int pageIndex;
  final bool autoPlay;

  @override
  Widget build(BuildContext context) {
    return _AppStoreScreenshotPager(
      initialPageIndex: pageIndex,
      autoPlay: autoPlay,
    );
  }
}

class _AppStoreScreenshotPager extends StatefulWidget {
  const _AppStoreScreenshotPager({
    required this.initialPageIndex,
    required this.autoPlay,
  });

  final int initialPageIndex;
  final bool autoPlay;

  @override
  State<_AppStoreScreenshotPager> createState() =>
      _AppStoreScreenshotPagerState();
}

class _AppStoreScreenshotPagerState extends State<_AppStoreScreenshotPager> {
  static const _pageCount = 5;

  Timer? _timer;
  late int _pageIndex = widget.initialPageIndex;

  @override
  void initState() {
    super.initState();
    if (widget.autoPlay) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!mounted) return;
        setState(() {
          _pageIndex = (_pageIndex + 1) % _pageCount;
        });
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const pages = <_ScreenshotPage>[
      _ScreenshotPage(
        eyebrow: 'OPENING QUESTION',
        title: 'Ask what matters now.',
        body:
            'Start with one clear question and receive a focused reading for the moment you ask.',
        child: _AskQuestionPreview(),
      ),
      _ScreenshotPage(
        eyebrow: 'FOCUS',
        title: 'Choose the life area.',
        body:
            'Keep the question specific: the person, project, decision, and time window all help the reading stay practical.',
        child: _TopicPreview(),
      ),
      _ScreenshotPage(
        eyebrow: 'CLEAR ANSWER',
        title: 'Begin with the judgment.',
        body:
            'Each reading opens with a direct answer, then explains the reason and the next useful move.',
        child: _AnswerPreview(),
      ),
      _ScreenshotPage(
        eyebrow: 'PRIVATE ARCHIVE',
        title: 'Save the thread.',
        body:
            'Return to previous readings, continue the same topic, and record what actually happened later.',
        child: _ArchivePreview(),
      ),
      _ScreenshotPage(
        eyebrow: 'PERSONALIZATION',
        title: 'Add birth details when ready.',
        body:
            'Optional profile details unlock more personal daily and long-range insight readings.',
        child: _ProfilePreview(),
      ),
    ];
    final page = pages[_pageIndex.clamp(0, pages.length - 1)];

    return MediaQuery(
      data: MediaQuery.of(context).copyWith(
        textScaler: TextScaler.noScaling,
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth >= 760) {
            return _TabletScreenshotFrame(page: page);
          }
          return _PhoneScreenshotFrame(page: page);
        },
      ),
    );
  }
}

class _PhoneScreenshotFrame extends StatelessWidget {
  const _PhoneScreenshotFrame({required this.page});

  final _ScreenshotPage page;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CosmicPalette.paper,
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 24, 18, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _BrandHeader(),
              const SizedBox(height: 34),
              _PageIntro(page: page, titleSize: 43, bodySize: 18),
              const SizedBox(height: 28),
              page.child,
            ],
          ),
        ),
      ),
    );
  }
}

class _TabletScreenshotFrame extends StatelessWidget {
  const _TabletScreenshotFrame({required this.page});

  final _ScreenshotPage page;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CosmicPalette.paper,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(56, 54, 56, 56),
          child: Row(
            children: [
              Expanded(
                flex: 9,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _BrandHeader(large: true),
                    const Spacer(),
                    _PageIntro(page: page, titleSize: 64, bodySize: 24),
                    const SizedBox(height: 32),
                    const Text(
                      'Private, focused, and built for one clear question at a time.',
                      style: TextStyle(
                        color: CosmicPalette.sage,
                        fontSize: 19,
                        height: 1.45,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(flex: 2),
                  ],
                ),
              ),
              const SizedBox(width: 54),
              Expanded(
                flex: 8,
                child: Align(
                  alignment: Alignment.center,
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 560),
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: const Color(0x99FCF9FF),
                      borderRadius: BorderRadius.circular(34),
                      border: Border.all(color: CosmicPalette.line),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x16120F28),
                          blurRadius: 38,
                          offset: Offset(0, 18),
                        ),
                      ],
                    ),
                    child: page.child,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader({this.large = false});

  final bool large;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _AppMark(size: large ? 64 : 46),
        SizedBox(width: large ? 16 : 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Oraya Insight',
                style: TextStyle(
                  color: CosmicPalette.ink,
                  fontSize: large ? 27 : 18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.2,
                ),
              ),
              SizedBox(height: large ? 4 : 2),
              Text(
                'Timing-based insight readings',
                style: TextStyle(
                  color: CosmicPalette.fog,
                  fontSize: large ? 16 : 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PageIntro extends StatelessWidget {
  const _PageIntro({
    required this.page,
    required this.titleSize,
    required this.bodySize,
  });

  final _ScreenshotPage page;
  final double titleSize;
  final double bodySize;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          page.eyebrow,
          style: const TextStyle(
            color: CosmicPalette.sage,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 2.4,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          page.title,
          style: TextStyle(
            color: CosmicPalette.ink,
            fontSize: titleSize,
            height: 1.04,
            fontWeight: FontWeight.w800,
            letterSpacing: -1.8,
          ),
        ),
        const SizedBox(height: 14),
        Text(
          page.body,
          style: TextStyle(
            color: CosmicPalette.fog,
            fontSize: bodySize,
            height: 1.45,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _ScreenshotPage {
  const _ScreenshotPage({
    required this.eyebrow,
    required this.title,
    required this.body,
    required this.child,
  });

  final String eyebrow;
  final String title;
  final String body;
  final Widget child;
}

class _AppMark extends StatelessWidget {
  const _AppMark({this.size = 46});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.326),
        gradient: const RadialGradient(
          center: Alignment(-0.18, -0.24),
          radius: 0.95,
          colors: [
            Color(0xFFFFE4D7),
            Color(0xFF806FC2),
            CosmicPalette.night,
          ],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x24120F28),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: const Icon(
        Icons.auto_awesome,
        color: Colors.white,
        size: 22,
      ),
    );
  }
}

class _AskQuestionPreview extends StatelessWidget {
  const _AskQuestionPreview();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _HeroPill(text: 'Ask a focused question.'),
        SizedBox(height: 18),
        _InstructionCard(),
        SizedBox(height: 18),
        _QuestionBox(
          text: 'Will this relationship improve over the next three months?',
        ),
        SizedBox(height: 18),
        _PrimaryButtonPreview(text: 'Ask your free opening question'),
      ],
    );
  }
}

class _InstructionCard extends StatelessWidget {
  const _InstructionCard();

  @override
  Widget build(BuildContext context) {
    return const _Panel(
      padding: EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        children: [
          _StepLine(
            number: '1',
            text: 'Take a breath and focus on what you want to know.',
          ),
          SizedBox(height: 12),
          _StepLine(
            number: '2',
            text: 'Keep it to one clear question.',
          ),
          SizedBox(height: 12),
          _StepLine(
            number: '3',
            text: 'Type it below and start the reading.',
          ),
        ],
      ),
    );
  }
}

class _StepLine extends StatelessWidget {
  const _StepLine({
    required this.number,
    required this.text,
  });

  final String number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: CosmicPalette.brassSoft,
            shape: BoxShape.circle,
          ),
          child: Text(
            number,
            style: const TextStyle(
              color: CosmicPalette.ocean,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: CosmicPalette.fog,
              fontSize: 14.5,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _TopicPreview extends StatelessWidget {
  const _TopicPreview();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _HeroPill(text: 'Specific questions give clearer answers.'),
        SizedBox(height: 18),
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _FieldLabel('Your question'),
              SizedBox(height: 10),
              Text(
                'Should I accept this new job offer before the end of April?',
                style: TextStyle(
                  color: CosmicPalette.ink,
                  fontSize: 21,
                  height: 1.35,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 18),
        _DropdownPreview(label: 'Work & career'),
        SizedBox(height: 18),
        _TipGrid(),
      ],
    );
  }
}

class _TipGrid extends StatelessWidget {
  const _TipGrid();

  @override
  Widget build(BuildContext context) {
    const tips = [
      (
        'Make it specific',
        'Name the person, project, school, or interview, and set a clear time window.',
      ),
    ];

    return Column(
      children: [
        for (final tip in tips) ...[
          _MiniInfoCard(title: tip.$1, body: tip.$2),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _AnswerPreview extends StatelessWidget {
  const _AnswerPreview();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _UserBubble(
          text: 'Should I continue this relationship right now?',
        ),
        SizedBox(height: 18),
        _Panel(
          padding: EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionLabel('Short answer'),
              SizedBox(height: 8),
              Text(
                'Yes, but only if the next conversation becomes more honest and specific.',
                style: TextStyle(
                  color: CosmicPalette.ink,
                  fontSize: 25,
                  height: 1.18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.7,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 12),
        _Panel(
          padding: EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionLabel('Why and next move'),
              SizedBox(height: 8),
              Text(
                'The situation still has movement, but words alone are not enough. Ask one direct question, then watch whether actions match the promise over the next two weeks.',
                style: TextStyle(
                  color: CosmicPalette.ink,
                  fontSize: 16,
                  height: 1.48,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ArchivePreview extends StatelessWidget {
  const _ArchivePreview();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _Panel(
          child: Row(
            children: [
              _SoftIcon(icon: Icons.feedback_outlined),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Outcome feedback available',
                      style: TextStyle(
                        color: CosmicPalette.ink,
                        fontSize: 19,
                        height: 1.2,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Record what happened and earn coins back.',
                      style: TextStyle(
                        color: CosmicPalette.fog,
                        fontSize: 14,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '4 coins',
                style: TextStyle(
                  color: CosmicPalette.ocean,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 14),
        _ConversationCard(
          title: 'Will this relationship improve this month?',
          detail: 'Status: delivered - free clarification reply',
        ),
        SizedBox(height: 12),
        _ConversationCard(
          title: 'Should I ask about the new role this week?',
          detail: 'Status: delivered - feedback available',
        ),
        SizedBox(height: 18),
        _Panel(
          padding: EdgeInsets.fromLTRB(18, 18, 18, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionLabel('Private archive'),
              SizedBox(height: 8),
              Text(
                'Keep each concern in one thread so follow-up readings stay cheaper and easier to compare.',
                style: TextStyle(
                  color: CosmicPalette.ink,
                  fontSize: 16,
                  height: 1.45,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ProfilePreview extends StatelessWidget {
  const _ProfilePreview();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _HeroPill(text: 'Personal insight is optional.'),
        SizedBox(height: 18),
        _Panel(
          padding: EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionLabel('Profile details'),
              SizedBox(height: 12),
              _ProfileField(label: 'Birth date'),
              SizedBox(height: 10),
              _ProfileField(label: 'Birth time (optional)'),
              SizedBox(height: 10),
              _ProfileField(label: 'Birth city'),
            ],
          ),
        ),
        SizedBox(height: 18),
        _PrimaryButtonPreview(text: 'Update and sign up'),
      ],
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [
            CosmicPalette.night,
            Color(0xFF372A72),
          ],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F120F28),
            blurRadius: 28,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          height: 1.1,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.8,
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({
    required this.child,
    this.padding = const EdgeInsets.all(18),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: CosmicPalette.cream,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: CosmicPalette.line, width: 1.1),
      ),
      child: child,
    );
  }
}

class _QuestionBox extends StatelessWidget {
  const _QuestionBox({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 170),
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
      decoration: BoxDecoration(
        color: CosmicPalette.cream,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: CosmicPalette.brass, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _FieldLabel('Your question'),
          const SizedBox(height: 14),
          Text(
            text,
            style: const TextStyle(
              color: CosmicPalette.ink,
              fontSize: 22,
              height: 1.35,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _DropdownPreview extends StatelessWidget {
  const _DropdownPreview({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      padding: const EdgeInsets.fromLTRB(18, 16, 16, 16),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: CosmicPalette.ink,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: CosmicPalette.fog,
            size: 28,
          ),
        ],
      ),
    );
  }
}

class _MiniInfoCard extends StatelessWidget {
  const _MiniInfoCard({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: CosmicPalette.ink,
              fontSize: 16,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            body,
            style: const TextStyle(
              color: CosmicPalette.fog,
              fontSize: 14.5,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        width: 330,
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 15),
        decoration: BoxDecoration(
          color: CosmicPalette.dusk,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 17,
            height: 1.35,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _ConversationCard extends StatelessWidget {
  const _ConversationCard({
    required this.title,
    required this.detail,
  });

  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Row(
        children: [
          const _SoftIcon(icon: Icons.explore_outlined),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: CosmicPalette.ink,
                    fontSize: 17,
                    height: 1.28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  detail,
                  style: const TextStyle(
                    color: CosmicPalette.fog,
                    fontSize: 13.5,
                    height: 1.3,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.chevron_right_rounded,
            color: CosmicPalette.ink,
            size: 26,
          ),
        ],
      ),
    );
  }
}

class _SoftIcon extends StatelessWidget {
  const _SoftIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: CosmicPalette.brassSoft,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Icon(
        icon,
        color: CosmicPalette.ink,
        size: 25,
      ),
    );
  }
}

class _ProfileField extends StatelessWidget {
  const _ProfileField({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: CosmicPalette.paper,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CosmicPalette.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: CosmicPalette.ink,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const Icon(
            Icons.chevron_right_rounded,
            color: CosmicPalette.fog,
          ),
        ],
      ),
    );
  }
}

class _PrimaryButtonPreview extends StatelessWidget {
  const _PrimaryButtonPreview({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 18),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: CosmicPalette.ink,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 17.5,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.2,
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: CosmicPalette.ocean,
        fontSize: 13,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: CosmicPalette.sage,
        fontSize: 13,
        fontWeight: FontWeight.w900,
        letterSpacing: 0.8,
      ),
    );
  }
}

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/api_client.dart';

class FirstImpressionAuditScreen extends StatefulWidget {
  const FirstImpressionAuditScreen({super.key});

  @override
  State<FirstImpressionAuditScreen> createState() =>
      _FirstImpressionAuditScreenState();
}

class _FirstImpressionAuditScreenState
    extends State<FirstImpressionAuditScreen> {
  final _api = ApiClient();
  late final TextEditingController _userIdController;

  bool _loading = false;
  Map<String, dynamic>? _result;
  String? _error;

  @override
  void initState() {
    super.initState();
    _userIdController = TextEditingController(
      text: Supabase.instance.client.auth.currentUser?.id ?? '',
    );
  }

  @override
  void dispose() {
    _userIdController.dispose();
    super.dispose();
  }

  Future<void> _runLookup() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await _api.fetchFirstImpressionDebug(
        userId: _userIdController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _result = result;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  String _buildAuditSummary(Map<String, dynamic> result) {
    final profile = Map<String, dynamic>.from(
      (result['profile'] as Map?) ?? const {},
    );
    final chart = Map<String, dynamic>.from(
      (result['chart'] as Map?) ?? const {},
    );
    final auditView = Map<String, dynamic>.from(
      (result['auditView'] as Map?) ?? const {},
    );
    final summary = Map<String, dynamic>.from(
      (auditView['summary'] as Map?) ?? const {},
    );
    final firstImpression = Map<String, dynamic>.from(
      (result['firstImpression'] as Map?) ?? const {},
    );
    final response = Map<String, dynamic>.from(
      (firstImpression['response'] as Map?) ?? const {},
    );
    final debug = Map<String, dynamic>.from(
      (firstImpression['debug'] as Map?) ?? const {},
    );
    final derivedFactors = Map<String, dynamic>.from(
      (debug['derivedFactors'] as Map?) ?? const {},
    );
    final top3Insights = ((response['top3Insights'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final incidents = ((result['incidents'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();

    final lines = <String>[
      'Oraya First Impression Audit',
      'User: ${(result['userId'] ?? '').toString()}',
      'State: ${(firstImpression['state'] ?? '').toString()}',
      'Render source: ${(firstImpression['renderSource'] ?? '').toString()}',
      'Ready: ${(firstImpression['ready'] ?? '').toString()}',
      '',
      'Profile',
      'DOB: ${(profile['dob'] ?? '').toString()}',
      'TOB: ${(profile['tob'] ?? '').toString()}',
      'Gender: ${(profile['gender'] ?? '').toString()}',
      'Birthplace: ${(profile['birthplace'] ?? '').toString()}',
      'Timezone: ${(profile['timezone'] ?? '').toString()}',
      '',
      'Chart',
      'Chart text: ${(chart['chart_text'] ?? '').toString()}',
      'Source: ${(summary['source'] ?? '').toString()}',
      'Day master: ${(summary['dayMaster'] ?? '').toString()}',
      'Location: ${(summary['location'] ?? '').toString()}',
      'True solar time: ${(summary['trueSolarTime'] ?? '').toString()}',
      'Kong wang: ${(summary['kongWang'] ?? '').toString()}',
      'Five elements: ${(summary['fiveElements'] ?? '').toString()}',
      '',
      'Headline',
      (response['headline'] ?? '').toString(),
      '',
      'Theme',
      (response['theme'] ?? '').toString(),
      '',
      'Top 3 insights',
    ];

    for (var i = 0; i < top3Insights.length; i++) {
      final item = top3Insights[i];
      lines.add('${i + 1}. ${(item['eyebrow'] ?? '').toString()}');
      lines.add('Title: ${(item['title'] ?? '').toString()}');
      lines.add('Body: ${(item['body'] ?? '').toString()}');
      lines.add('');
    }

    lines.addAll([
      'Derived factors',
      'Strong element: ${(derivedFactors['strongElement'] ?? '').toString()}',
      'Weak element: ${(derivedFactors['weakElement'] ?? '').toString()}',
      'Day element: ${(derivedFactors['dayElement'] ?? '').toString()}',
      'Day stem: ${(derivedFactors['dayStem'] ?? '').toString()}',
      'Day stage: ${(derivedFactors['dayStage'] ?? '').toString()}',
      'Kong wang: ${(derivedFactors['kongWang'] ?? '').toString()}',
      'Month relation: ${(derivedFactors['monthRelation'] ?? '').toString()}',
      'Day relation: ${(derivedFactors['dayRelation'] ?? '').toString()}',
      '',
      'Incidents',
    ]);

    if (incidents.isEmpty) {
      lines.add('None');
    } else {
      for (final incident in incidents) {
        lines.add(
          '- ${(incident['incident_type'] ?? '').toString()}: ${(incident['message'] ?? '').toString()}',
        );
      }
    }

    return lines.join('\n');
  }

  Future<void> _copyAuditSummary() async {
    if (_result == null) return;
    final summary = _buildAuditSummary(_result!);
    await Clipboard.setData(ClipboardData(text: summary));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Audit summary copied.')),
    );
  }

  Widget _metaRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFFEDEAFF), height: 1.45),
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFFFFD6C4),
              ),
            ),
            TextSpan(text: value.isEmpty ? '—' : value),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title, {String? subtitle}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          if (subtitle != null && subtitle.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(
                height: 1.45,
                color: Color(0xFFC9C1F2),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _darkCard({
    required Widget child,
    EdgeInsets padding = const EdgeInsets.all(16),
  }) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: const Color(0xFF231A4A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF4C3D86)),
      ),
      child: child,
    );
  }

  Widget _rawJsonCard(String title, Object? data) {
    return _darkCard(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Theme(
        data: Theme.of(context).copyWith(
          dividerColor: Colors.transparent,
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
        ),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
          childrenPadding: const EdgeInsets.fromLTRB(10, 0, 10, 12),
          iconColor: const Color(0xFFFFD6C4),
          collapsedIconColor: const Color(0xFFFFD6C4),
          title: Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          children: [
            SelectableText(
              const JsonEncoder.withIndent('  ').convert(data),
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
                height: 1.45,
                color: Color(0xFFEDEAFF),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _auditTableCard({
    required String title,
    required Map<String, dynamic> table,
  }) {
    final columns = ((table['columns'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final rows = ((table['rows'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    if (columns.isEmpty || rows.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          Table(
            border: TableBorder.all(color: const Color(0xFFE6E9F4)),
            columnWidths: const {0: FixedColumnWidth(96)},
            defaultVerticalAlignment: TableCellVerticalAlignment.middle,
            children: [
              TableRow(
                decoration: const BoxDecoration(color: Color(0xFFF7F4FF)),
                children: [
                  const Padding(
                    padding: EdgeInsets.all(10),
                    child: Text(''),
                  ),
                  ...columns.map(
                    (column) => Padding(
                      padding: const EdgeInsets.all(10),
                      child: Text(
                        (column['label'] ?? '').toString(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
              ...rows.map((row) {
                final values = ((row['values'] as List?) ?? const [])
                    .map((item) => item.toString())
                    .toList();
                return TableRow(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(10),
                      child: Text(
                        (row['label'] ?? '').toString(),
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF6F61D9),
                        ),
                      ),
                    ),
                    ...values.map(
                      (value) => Padding(
                        padding: const EdgeInsets.all(10),
                        child: Text(
                          value.isEmpty ? '—' : value,
                          textAlign: TextAlign.center,
                          style: const TextStyle(height: 1.35),
                        ),
                      ),
                    ),
                  ],
                );
              }),
            ],
          ),
        ],
      ),
    );
  }

  Widget _auditCard(Map<String, dynamic> auditView) {
    final summary = Map<String, dynamic>.from(
      (auditView['summary'] as Map?) ?? const {},
    );
    final natalTable = Map<String, dynamic>.from(
      (auditView['natalTable'] as Map?) ?? const {},
    );
    final flowTable = Map<String, dynamic>.from(
      (auditView['flowTable'] as Map?) ?? const {},
    );
    final readableLines = ((auditView['readableLines'] as List?) ?? const [])
        .map((item) => item.toString())
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...readableLines.map(
                (line) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(line, style: const TextStyle(height: 1.45)),
                ),
              ),
              if ((summary['source'] ?? '').toString().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    '命盘来源：${(summary['source'] ?? '').toString()}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6C7085),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _auditTableCard(title: '四柱命盘', table: natalTable),
        if (flowTable.isNotEmpty) ...[
          const SizedBox(height: 12),
          _auditTableCard(title: '当前流转', table: flowTable),
        ],
      ],
    );
  }

  Widget _profileSnapshotCard(
    Map<String, dynamic> profile,
    Map<String, dynamic> chart,
  ) {
    final analysis = Map<String, dynamic>.from(
      (chart['analysis'] as Map?) ?? const {},
    );
    final timing = Map<String, dynamic>.from(
      (analysis['timing'] as Map?) ?? const {},
    );
    final location = Map<String, dynamic>.from(
      (timing['location'] as Map?) ?? const {},
    );

    return _darkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'User & profile snapshot',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          _metaRow('DOB', (profile['dob'] ?? '').toString()),
          _metaRow('TOB', (profile['tob'] ?? '').toString()),
          _metaRow('Gender', (profile['gender'] ?? '').toString()),
          _metaRow('Birthplace', (profile['birthplace'] ?? '').toString()),
          _metaRow('Timezone', (profile['timezone'] ?? '').toString()),
          _metaRow('Intent', (profile['intent'] ?? '').toString()),
          _metaRow(
            'Stored chart',
            (chart['chart_text'] ?? '').toString(),
          ),
          _metaRow(
            'Resolved location',
            (location['normalizedName'] ?? '').toString(),
          ),
        ],
      ),
    );
  }

  Widget _insightPreviewCard(
    Map<String, dynamic> response,
    List<Map<String, dynamic>> top3Insights,
  ) {
    final headline = (response['headline'] ?? '').toString();
    final theme = (response['theme'] ?? '').toString();
    final nextBestMove = (response['nextBestMove'] ?? '').toString();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (headline.isNotEmpty || theme.isNotEmpty)
          _darkCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'First impression draft',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                if (headline.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    headline,
                    style: const TextStyle(
                      fontSize: 24,
                      height: 1.15,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ],
                if (theme.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    theme,
                    style: const TextStyle(
                      height: 1.5,
                      color: Color(0xFFEDEAFF),
                    ),
                  ),
                ],
                if (nextBestMove.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Next best move: $nextBestMove',
                    style: const TextStyle(
                      height: 1.45,
                      color: Color(0xFFFFD6C4),
                    ),
                  ),
                ],
              ],
            ),
          ),
        if (top3Insights.isNotEmpty) ...[
          const SizedBox(height: 12),
          ...top3Insights.asMap().entries.map(
            (entry) {
              final item = entry.value;
              return Padding(
                padding: EdgeInsets.only(
                    bottom: entry.key == top3Insights.length - 1 ? 0 : 12),
                child: _darkCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (item['eyebrow'] ?? '').toString(),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFFFD6C4),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        (item['title'] ?? '').toString(),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        (item['body'] ?? '').toString(),
                        style: const TextStyle(
                          height: 1.5,
                          color: Color(0xFFEDEAFF),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ],
    );
  }

  Widget _derivedFactorsCard(Map<String, dynamic> derivedFactors) {
    String read(String key) => (derivedFactors[key] ?? '').toString();
    String joinList(String key) => ((derivedFactors[key] as List?) ?? const [])
        .map((item) => item.toString())
        .where((item) => item.trim().isNotEmpty)
        .join('、');

    return _darkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Derived factors',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          _metaRow('Strong element', read('strongElement')),
          _metaRow('Weak element', read('weakElement')),
          _metaRow('Day element', read('dayElement')),
          _metaRow('Favorable element', read('favorableElement')),
          _metaRow('Unfavorable element', read('unfavorableElement')),
          _metaRow('Day stem', read('dayStem')),
          _metaRow('Day stem style', read('dayStemStyle')),
          _metaRow('Day stage', read('dayStage')),
          _metaRow('Day stage meaning', read('dayStageMeaning')),
          _metaRow('Kong wang', read('kongWang')),
          _metaRow('Markers', joinList('markers')),
          _metaRow('Month relation', read('monthRelation')),
          _metaRow('Day relation', read('dayRelation')),
        ],
      ),
    );
  }

  Widget _incidentsCard(List incidents) {
    if (incidents.isEmpty) {
      return _darkCard(
        child: const Text(
          'No incidents recorded for this user.',
          style: TextStyle(color: Color(0xFFEDEAFF)),
        ),
      );
    }

    return _darkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Internal incidents',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          ...incidents.map((item) {
            final incident = Map<String, dynamic>.from(item as Map);
            return Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF2B2059),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF564596)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (incident['incident_type'] ?? '').toString(),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFFFD6C4),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    (incident['message'] ?? '').toString(),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    [
                      (incident['severity'] ?? '').toString(),
                      (incident['status'] ?? '').toString(),
                      (incident['created_at'] ?? '').toString(),
                    ].where((item) => item.trim().isNotEmpty).join(' · '),
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFFC9C1F2),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _resultView() {
    if (_result == null) return const SizedBox.shrink();

    final profile = Map<String, dynamic>.from(
      (_result!['profile'] as Map?) ?? const {},
    );
    final chart = Map<String, dynamic>.from(
      (_result!['chart'] as Map?) ?? const {},
    );
    final auditView = Map<String, dynamic>.from(
      (_result!['auditView'] as Map?) ?? const {},
    );
    final firstImpression = Map<String, dynamic>.from(
      (_result!['firstImpression'] as Map?) ?? const {},
    );
    final response = Map<String, dynamic>.from(
      (firstImpression['response'] as Map?) ?? const {},
    );
    final debug = Map<String, dynamic>.from(
      (firstImpression['debug'] as Map?) ?? const {},
    );
    final derivedFactors = Map<String, dynamic>.from(
      (debug['derivedFactors'] as Map?) ?? const {},
    );
    final top3Insights = ((response['top3Insights'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final incidents = (_result!['incidents'] as List?) ?? const [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF2B2059),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFF564596)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                (firstImpression['state'] ?? 'unknown').toString(),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: Color(0xFFFFD6C4),
                ),
              ),
              const SizedBox(height: 10),
              _metaRow('User', (_result!['userId'] ?? '').toString()),
              _metaRow(
                'Render source',
                (firstImpression['renderSource'] ?? '').toString(),
              ),
              _metaRow(
                'Ready',
                (firstImpression['ready'] ?? false).toString(),
              ),
              _metaRow(
                'Frontend fallback would trigger',
                (_result!['frontendFallbackWouldTrigger'] ?? false).toString(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (auditView.isNotEmpty) ...[
          _sectionTitle(
            '命盘审阅',
            subtitle: '以更接近问真式的表格查看四柱、流转和命盘摘要，方便人工核查。',
          ),
          _auditCard(auditView),
          const SizedBox(height: 16),
        ],
        _sectionTitle(
          '档案概览',
          subtitle: '先看用户资料和这条盘是不是你预期的那个人，再看洞察和事故记录。',
        ),
        _profileSnapshotCard(profile, chart),
        const SizedBox(height: 16),
        _sectionTitle(
          '三条洞察原稿',
          subtitle: '这里显示的是系统生成后的原始结构，不是用户端最终润色后的页面文案。',
        ),
        _insightPreviewCard(response, top3Insights),
        const SizedBox(height: 16),
        _sectionTitle(
          '内部因子与留痕',
          subtitle: '用于判断系统到底命中了哪些因子、为什么会阻断、以及有没有历史 fallback 问题。',
        ),
        if (derivedFactors.isNotEmpty) ...[
          _derivedFactorsCard(derivedFactors),
          const SizedBox(height: 12),
        ],
        _incidentsCard(incidents),
        const SizedBox(height: 16),
        _sectionTitle(
          '原始数据',
          subtitle: '展开后可看 profile、chart、完整 first-impression 结果，便于技术排查。',
        ),
        _rawJsonCard('Profile', profile),
        const SizedBox(height: 12),
        _rawJsonCard('Chart', chart),
        const SizedBox(height: 12),
        _rawJsonCard('First impression raw result', firstImpression),
        if (derivedFactors.isNotEmpty) ...[
          const SizedBox(height: 12),
          _rawJsonCard('Derived factors raw', derivedFactors),
        ],
      ],
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
        title: const Text('First Impression Audit'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Internal review only. Use an admin-authenticated session to inspect a user profile, chart, derived factors, and the raw three-insight structure.',
                style: TextStyle(height: 1.5),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _userIdController,
                decoration: InputDecoration(
                  labelText: 'User ID',
                  hintText: 'Enter a user UUID',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _loading ? null : _runLookup,
                  child: Text(_loading ? 'Loading...' : 'Load audit view'),
                ),
              ),
              if (_result != null) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _copyAuditSummary,
                    child: const Text('Copy audit summary'),
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF1F1),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFFCACA)),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                      color: Color(0xFF8B2D2D),
                      height: 1.4,
                    ),
                  ),
                ),
              ],
              if (_result != null) ...[
                const SizedBox(height: 20),
                _resultView(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

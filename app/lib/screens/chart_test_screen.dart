import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/api_client.dart';

class ChartTestScreen extends StatefulWidget {
  const ChartTestScreen({super.key});

  @override
  State<ChartTestScreen> createState() => _ChartTestScreenState();
}

class _ChartTestScreenState extends State<ChartTestScreen> {
  final _api = ApiClient();
  final _dobController = TextEditingController();
  final _tobController = TextEditingController();
  final _birthplaceController =
      TextEditingController(text: 'Changchun, Jilin, China');
  final _timezoneController = TextEditingController(text: 'Asia/Shanghai');

  bool _loading = false;
  Map<String, dynamic>? _result;
  String? _error;

  Future<void> _runPreview() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await _api.previewChart(
        dob: _dobController.text.trim(),
        tob: _tobController.text.trim().isEmpty
            ? null
            : _tobController.text.trim(),
        birthplace: _birthplaceController.text.trim(),
        timezone: _timezoneController.text.trim(),
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

  Widget _field(String label, TextEditingController controller, String hint) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }

  Widget _resultBlock() {
    if (_result == null) return const SizedBox.shrink();

    final source = (_result!['source'] ?? '').toString();
    final analysis = Map<String, dynamic>.from(
      (_result!['analysis'] as Map?) ?? const {},
    );
    final pillars = Map<String, dynamic>.from(
      (_result!['pillars'] as Map?) ?? const {},
    );
    final resolvedLocation = Map<String, dynamic>.from(
      (_result!['resolved_location'] as Map?) ?? const {},
    );
    final dayMaster = Map<String, dynamic>.from(
      (analysis['dayMaster'] as Map?) ?? const {},
    );
    final fiveElements = Map<String, dynamic>.from(
      (analysis['fiveElements'] as Map?) ?? const {},
    );
    final timing = Map<String, dynamic>.from(
      (analysis['timing'] as Map?) ?? const {},
    );
    final nayin = Map<String, dynamic>.from(
      (analysis['nayin'] as Map?) ?? const {},
    );
    final twelveLifeStages = Map<String, dynamic>.from(
      (analysis['twelveLifeStages'] as Map?) ?? const {},
    );
    final kongWang = Map<String, dynamic>.from(
      (analysis['kongWang'] as Map?) ?? const {},
    );
    final shenSha = Map<String, dynamic>.from(
      (analysis['shenSha'] as Map?) ?? const {},
    );
    final dayun = Map<String, dynamic>.from(
      (analysis['dayun'] as Map?) ?? const {},
    );
    final engineMetadata = Map<String, dynamic>.from(
      (analysis['engineMetadata'] as Map?) ?? const {},
    );
    final comparison = Map<String, dynamic>.from(
      (_result!['comparison'] as Map?) ?? const {},
    );
    final currentFlow = Map<String, dynamic>.from(
      (_result!['current_flow'] as Map?) ?? const {},
    );
    final auditView = Map<String, dynamic>.from(
      (_result!['audit_view'] as Map?) ?? const {},
    );
    final lunarComparison = Map<String, dynamic>.from(
      (comparison['lunarJavascript'] as Map?) ?? const {},
    );
    final rawPayload = _result!['raw_payload'];
    final notes = ((analysis['notes'] as List?) ?? const [])
        .map((item) => item.toString())
        .toList();
    final isFallback = source == 'fallback';
    final chartLevel = ((shenSha['chartLevel'] as List?) ?? const [])
        .map((item) => item.toString())
        .toList();
    final flowReference = Map<String, dynamic>.from(
      (currentFlow['referenceTime'] as Map?) ?? const {},
    );
    final liuNian = Map<String, dynamic>.from(
      (currentFlow['liuNian'] as Map?) ?? const {},
    );
    final liuYue = Map<String, dynamic>.from(
      (currentFlow['liuYue'] as Map?) ?? const {},
    );
    final liuRi = Map<String, dynamic>.from(
      (currentFlow['liuRi'] as Map?) ?? const {},
    );
    final cycles = ((dayun['cycles'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final differingPillars =
        ((lunarComparison['differingPillars'] as List?) ?? const [])
            .map((item) => item.toString())
            .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color:
                isFallback ? const Color(0xFFFFF1F1) : const Color(0xFFEAF7EF),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isFallback
                  ? const Color(0xFFFFCACA)
                  : const Color(0xFFBFE3C7),
            ),
          ),
          child: Text(
            isFallback
                ? 'This preview is using fallback logic. Do not use it to validate chart accuracy.'
                : 'This preview is using the custom hybrid engine. The lunar-javascript result below is only a comparison layer.',
            style: TextStyle(
              color: isFallback
                  ? const Color(0xFF8B2D2D)
                  : const Color(0xFF1F6F44),
              height: 1.4,
            ),
          ),
        ),
        const SizedBox(height: 16),
        SelectableText(
          (_result!['chart_text'] ?? '').toString(),
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        if (auditView.isNotEmpty) ...[
          _auditViewBlock(auditView),
          const SizedBox(height: 16),
        ],
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _pillCard('Year', (pillars['year'] ?? '').toString()),
            _pillCard('Month', (pillars['month'] ?? '').toString()),
            _pillCard('Day', (pillars['day'] ?? '').toString()),
            _pillCard('Hour', (pillars['hour'] ?? '').toString()),
          ],
        ),
        const SizedBox(height: 16),
        _metaRow('Source', source),
        _metaRow('Engine', (analysis['engine'] ?? '').toString()),
        _metaRow(
          'Day pillar method',
          (engineMetadata['dayPillarMethod'] ?? '').toString(),
        ),
        _metaRow(
          'Zi hour boundary',
          (engineMetadata['ziHourBoundary'] ?? '').toString(),
        ),
        _metaRow(
          'Day master',
          '${(dayMaster['stem'] ?? '').toString()}${(dayMaster['branch'] ?? '').toString()} · ${(dayMaster['element'] ?? '').toString()}',
        ),
        _metaRow(
            'Strong element', (analysis['strongElement'] ?? '').toString()),
        _metaRow('Weak element', (analysis['weakElement'] ?? '').toString()),
        _metaRow('Five elements', jsonEncode(fiveElements)),
        _metaRow(
          'Resolved place',
          (resolvedLocation['normalizedName'] ?? '').toString(),
        ),
        _metaRow(
          'Timing',
          '${(timing['localCivilTime'] ?? '').toString()} -> ${(timing['trueSolarTime'] ?? '').toString()}',
        ),
        _metaRow(
          'DST / timezone',
          'dst=${(timing['dstApplied'] ?? '').toString()} · ${(timing['timezone'] ?? '').toString()}',
        ),
        _metaRow(
          'Longitude / EOT',
          '${(timing['longitudeCorrectionMinutes'] ?? '').toString()} min / ${(timing['equationOfTimeMinutes'] ?? '').toString()} min',
        ),
        _metaRow('NaYin', jsonEncode(nayin)),
        _metaRow('Twelve life stages', jsonEncode(twelveLifeStages)),
        _metaRow('Kong wang', (kongWang['display'] ?? '').toString()),
        if (chartLevel.isNotEmpty)
          _metaRow('Chart-level shen sha', chartLevel.join(', ')),
        if (cycles.isNotEmpty)
          _metaRow(
            'DaYun',
            '${(dayun['displayAge'] ?? '').toString()} · ${(dayun['direction'] ?? '').toString()}',
          ),
        if (notes.isNotEmpty) _metaRow('Notes', notes.join(', ')),
        if (cycles.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text(
            'DaYun cycles',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          ...cycles.take(6).map(
                (cycle) => _metaRow(
                  '#${cycle['index']}',
                  '${(cycle['ganZhi'] ?? '').toString()} · ${(cycle['range'] ?? '').toString()}',
                ),
              ),
        ],
        if (currentFlow.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text(
            'Current flow',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          _metaRow(
            'Reference',
            '${(flowReference['localCivilTime'] ?? '').toString()} -> ${(flowReference['trueSolarTime'] ?? '').toString()}',
          ),
          _metaRow(
            'Liu nian',
            '${(liuNian['pillar'] ?? '').toString()} · ${(liuNian['nayin'] ?? '').toString()} · ${(liuNian['twelveLifeStage'] ?? '').toString()}',
          ),
          _metaRow(
            'Liu yue',
            '${(liuYue['pillar'] ?? '').toString()} · ${(liuYue['nayin'] ?? '').toString()} · ${(liuYue['twelveLifeStage'] ?? '').toString()}',
          ),
          _metaRow(
            'Liu ri',
            '${(liuRi['pillar'] ?? '').toString()} · ${(liuRi['nayin'] ?? '').toString()} · ${(liuRi['twelveLifeStage'] ?? '').toString()} · 空亡 ${(Map<String, dynamic>.from((liuRi['kongWang'] as Map?) ?? const {})['display'] ?? '').toString()}',
          ),
        ],
        if (lunarComparison.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text(
            'Comparison',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          _metaRow(
            'lunar-javascript pillars',
            (lunarComparison['chartText'] ?? '').toString(),
          ),
          _metaRow(
            'Matches',
            (lunarComparison['matches'] ?? '').toString(),
          ),
          if (differingPillars.isNotEmpty)
            _metaRow('Differences', differingPillars.join(', ')),
        ],
        const SizedBox(height: 16),
        ExpansionTile(
          title: const Text('Raw payload'),
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: SelectableText(
                const JsonEncoder.withIndent('  ').convert(rawPayload),
                style: const TextStyle(fontFamily: 'monospace', height: 1.4),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _auditViewBlock(Map<String, dynamic> auditView) {
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
        const Text(
          'Audit view',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE6E9F4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (readableLines.isNotEmpty)
                ...readableLines.map(
                  (line) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      line,
                      style: const TextStyle(height: 1.45),
                    ),
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
        _auditTableCard(
          title: '四柱命盘',
          table: natalTable,
        ),
        if (flowTable.isNotEmpty) ...[
          const SizedBox(height: 12),
          _auditTableCard(
            title: '当前流转',
            table: flowTable,
          ),
        ],
      ],
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
        border: Border.all(color: const Color(0xFFE6E9F4)),
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
            columnWidths: const {
              0: FixedColumnWidth(86),
            },
            defaultVerticalAlignment: TableCellVerticalAlignment.middle,
            children: [
              TableRow(
                decoration: const BoxDecoration(color: Color(0xFFF7F4FF)),
                children: [
                  const Padding(
                    padding: EdgeInsets.all(10),
                    child: Text(
                      '',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
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
              ...rows.map(
                (row) {
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
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _pillCard(String label, String value) {
    return Container(
      width: 110,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6E9F4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF6F61D9),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _metaRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF262B3F), height: 1.45),
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            TextSpan(text: value),
          ],
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
        title: const Text('Chart Test'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Use this hidden page to verify the four pillars before trusting any interpretation layer.',
            style: TextStyle(height: 1.5),
          ),
          const SizedBox(height: 16),
          _field('Birth date', _dobController, 'YYYY-MM-DD'),
          _field('Birth time', _tobController, 'HH:MM'),
          _field(
              'Birth city', _birthplaceController, 'Changchun, Jilin, China'),
          _field('Timezone', _timezoneController, 'Asia/Shanghai'),
          FilledButton(
            onPressed: _loading ? null : _runPreview,
            child: Text(_loading ? 'Calculating...' : 'Preview chart'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(color: Colors.red, height: 1.4),
            ),
          ],
          const SizedBox(height: 20),
          _resultBlock(),
        ],
      ),
    );
  }
}

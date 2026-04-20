import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/api_client.dart';

class QimenTestScreen extends StatefulWidget {
  const QimenTestScreen({super.key});

  @override
  State<QimenTestScreen> createState() => _QimenTestScreenState();
}

class _QimenTestScreenState extends State<QimenTestScreen> {
  final _api = ApiClient();
  final _datetimeController = TextEditingController(text: '2026-03-17T10:00');
  final _timezoneController = TextEditingController(text: 'Asia/Shanghai');
  String _systemProfile = 'chai_bu';

  bool _loading = false;
  Map<String, dynamic>? _result;
  String? _error;

  Future<void> _runPreview() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await _api.previewQimen(
        submittedAt: _datetimeController.text.trim(),
        timezone: _timezoneController.text.trim(),
        systemProfile: _systemProfile,
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

  Widget _field(
    String label,
    TextEditingController controller,
    String hint,
  ) {
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

  Widget _metaRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: SelectableText(value)),
        ],
      ),
    );
  }

  Widget _palaceCard(Map<String, dynamic> palace) {
    final notes = ((palace['notes'] as List?) ?? const [])
        .map((item) => item.toString())
        .where((item) => item.isNotEmpty)
        .toList();
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE3E7F1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            (palace['label'] ?? '').toString(),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          _metaRow('Earth', (palace['earth_plate_stem'] ?? '').toString()),
          _metaRow('Heaven', (palace['heaven_plate_stem'] ?? '').toString()),
          _metaRow('Star', (palace['star'] ?? '').toString()),
          _metaRow('Gate', (palace['gate'] ?? '').toString()),
          _metaRow('Deity', (palace['deity'] ?? '').toString()),
          if (notes.isNotEmpty) _metaRow('Notes', notes.join(', ')),
        ],
      ),
    );
  }

  Widget _resultBlock() {
    if (_result == null) return const SizedBox.shrink();

    final input = Map<String, dynamic>.from((_result!['input'] as Map?) ?? {});
    final timing =
        Map<String, dynamic>.from((_result!['timing'] as Map?) ?? {});
    final calendar = Map<String, dynamic>.from(
      (_result!['calendar_context'] as Map?) ?? {},
    );
    final chart = Map<String, dynamic>.from((_result!['chart'] as Map?) ?? {});
    final markers =
        Map<String, dynamic>.from((_result!['markers'] as Map?) ?? {});
    final valueSummary = Map<String, dynamic>.from(
      (_result!['value_summary'] as Map?) ?? {},
    );
    final engineMetadata = Map<String, dynamic>.from(
      (_result!['engine_metadata'] as Map?) ?? {},
    );
    final debug = Map<String, dynamic>.from((_result!['debug'] as Map?) ?? {});
    final palaces = ((_result!['palaces'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final outOfScope = engineMetadata['out_of_scope'] == true;
    final systemProfile =
        (chart['system_profile'] ?? input['system_profile'] ?? '').toString();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color:
                outOfScope ? const Color(0xFFFFF1F1) : const Color(0xFFEAF7EF),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: outOfScope
                  ? const Color(0xFFFFCACA)
                  : const Color(0xFFBFE3C7),
            ),
          ),
          child: Text(
            outOfScope
                ? 'This request is outside the current Yang Dun v1 scope.'
                : systemProfile == 'zhi_run'
                    ? 'This preview is running the custom Yang Dun plugin in oracle-backed mQimen-compatible ZhiRun mode.'
                    : 'This preview is running the custom Yang Dun plugin in mQimen-compatible ChaiBu mode.',
            style: TextStyle(
              color: outOfScope
                  ? const Color(0xFF8B2D2D)
                  : const Color(0xFF1F6F44),
            ),
          ),
        ),
        const SizedBox(height: 16),
        _metaRow(
          'Submission',
          '${(input['submission_datetime'] ?? '').toString()} · ${(input['timezone'] ?? '').toString()}',
        ),
        _metaRow(
          'Timing basis',
          (timing['casting_time_basis'] ?? '').toString(),
        ),
        _metaRow(
          'Local time',
          (timing['local_datetime'] ?? '').toString(),
        ),
        _metaRow(
          'UTC time',
          (timing['utc_datetime'] ?? '').toString(),
        ),
        _metaRow(
          'Solar term',
          '${(calendar['solar_term'] ?? '').toString()} · season ${(calendar['season_id'] ?? '').toString()}',
        ),
        _metaRow(
          'BaZi context',
          '${(calendar['year_ganzhi'] ?? '').toString()} ${(calendar['month_ganzhi'] ?? '').toString()} ${(calendar['day_ganzhi'] ?? '').toString()} ${(calendar['hour_ganzhi'] ?? '').toString()}',
        ),
        if (chart.isNotEmpty) ...[
          _metaRow(
            'Chart',
            '${(chart['yin_yang'] ?? '').toString()} ${((chart['bureau_number'] ?? '')).toString()}局 · ${(chart['system_profile'] ?? '').toString()}',
          ),
          _metaRow('旬首', (chart['xun_shou'] ?? '').toString()),
          _metaRow('值符', (valueSummary['zhi_fu'] ?? '').toString()),
          _metaRow('值使', (valueSummary['zhi_shi'] ?? '').toString()),
          _metaRow('符头', (valueSummary['fu_tou'] ?? '').toString()),
        ],
        if (markers.isNotEmpty) ...[
          _metaRow(
            '空亡',
            ((markers['kong_wang'] as List?) ?? const []).join(', '),
          ),
          _metaRow(
            '马星',
            jsonEncode(markers['horse_star'] ?? const {}),
          ),
        ],
        const SizedBox(height: 16),
        const Text(
          'Nine palaces',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        ...palaces.map(
          (palace) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _palaceCard(palace),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Engine metadata',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        _metaRow('Engine', (engineMetadata['engine'] ?? '').toString()),
        _metaRow(
          'Rule profile',
          (engineMetadata['rule_profile'] ?? '').toString(),
        ),
        _metaRow(
          'Oracle target',
          (engineMetadata['compatibility_target'] ?? '').toString(),
        ),
        if (debug.isNotEmpty) _metaRow('Debug', jsonEncode(debug)),
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
        title: const Text('QiMen Test'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _field('Submitted at', _datetimeController, '2026-03-17T10:00'),
            _field('Timezone', _timezoneController, 'Asia/Shanghai'),
            const SizedBox(height: 4),
            DropdownButtonFormField<String>(
              initialValue: _systemProfile,
              decoration: const InputDecoration(
                labelText: 'System profile',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'chai_bu', child: Text('ChaiBu')),
                DropdownMenuItem(value: 'zhi_run', child: Text('ZhiRun')),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() => _systemProfile = value);
              },
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loading ? null : _runPreview,
              child:
                  Text(_loading ? 'Generating...' : 'Preview Yang Dun chart'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(
                _error!,
                style: const TextStyle(color: Color(0xFFB42318)),
              ),
            ],
            const SizedBox(height: 20),
            _resultBlock(),
          ],
        ),
      ),
    );
  }
}

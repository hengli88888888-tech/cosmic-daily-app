import 'dart:async';
import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;

import '../services/api_client.dart';
import '../theme/cosmic_theme.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({
    super.key,
    this.mode,
    this.source,
    this.threadId,
  });

  final String? mode;
  final String? source;
  final String? threadId;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _api = ApiClient();
  DateTime? _dob;
  TimeOfDay? _tob;
  String? _gender;
  bool _submitting = false;

  final TextEditingController _dobController = TextEditingController();
  final TextEditingController _tobController = TextEditingController();
  final TextEditingController _birthplaceController = TextEditingController();
  final FocusNode _birthplaceFocus = FocusNode();

  Timer? _debounce;
  bool _isLoadingCities = false;
  List<String> _citySuggestions = [];

  Future<void> _searchCities(String query) async {
    final q = query.trim();
    if (q.length < 2) {
      if (!mounted) return;
      setState(() {
        _citySuggestions = [];
        _isLoadingCities = false;
      });
      return;
    }

    setState(() => _isLoadingCities = true);

    try {
      final uri = Uri.parse(
        'https://geocoding-api.open-meteo.com/v1/search?name=${Uri.encodeQueryComponent(q)}&count=12&language=en&format=json',
      );
      final res = await http.get(uri);
      if (res.statusCode != 200) throw Exception('status ${res.statusCode}');

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final results = (body['results'] as List<dynamic>? ?? []);

      final items = <String>{};
      for (final r in results) {
        final map = r as Map<String, dynamic>;
        final name = (map['name'] ?? '').toString();
        final admin1 = (map['admin1'] ?? '').toString();
        final country = (map['country'] ?? '').toString();

        final parts = <String>[name];
        if (admin1.isNotEmpty && admin1 != name) parts.add(admin1);
        if (country.isNotEmpty) parts.add(country);
        items.add(parts.where((e) => e.isNotEmpty).join(', '));
      }

      if (!mounted) return;
      setState(() {
        _citySuggestions = items.toList();
        _isLoadingCities = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _citySuggestions = [];
        _isLoadingCities = false;
      });
    }
  }

  void _onBirthplaceChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _searchCities(value);
    });
    setState(() {});
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final initial = _dob ?? DateTime(now.year - 25, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Select your date',
    );
    if (picked != null) {
      setState(() {
        _dob = picked;
        _dobController.text = _formatDate(picked);
      });
    }
  }

  Future<void> _pickTimeWheel() async {
    final now = TimeOfDay.now();
    DateTime selected = DateTime(
      2000,
      1,
      1,
      _tob?.hour ?? now.hour,
      _tob?.minute ?? now.minute,
    );

    final result = await showModalBottomSheet<bool>(
      context: context,
      builder: (ctx) => SizedBox(
        height: 280,
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Cancel')),
                TextButton(
                  onPressed: () {
                    setState(() => _tob = null);
                    Navigator.pop(ctx, false);
                  },
                  child: const Text('Unknown'),
                ),
                TextButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Done')),
              ],
            ),
            Expanded(
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.time,
                use24hFormat: true,
                initialDateTime: selected,
                onDateTimeChanged: (v) => selected = v,
              ),
            ),
          ],
        ),
      ),
    );

    if (result == true) {
      setState(() {
        _tob = TimeOfDay(hour: selected.hour, minute: selected.minute);
        _tobController.text = _formatTime(_tob);
      });
    }
  }

  String _formatDate(DateTime? d) {
    if (d == null) return '';
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  String _formatTime(TimeOfDay? t) {
    if (t == null) return '';
    return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _submit() async {
    final dob = _normalizedDateInput();
    final tob = _normalizedTimeInput();
    final birthplace = _birthplaceController.text.trim();

    if (dob.isEmpty || birthplace.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content:
                Text('Please complete a few details to tune your reading.')),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      await _api.saveProfileAndChart(
        dob: dob,
        tob: tob.isEmpty ? null : tob,
        gender: _gender,
        birthplace: birthplace,
        timezone: DateTime.now().timeZoneName,
      );

      if (!mounted) return;
      if (_requiresSignupStep) {
        context.go(
          Uri(
            path: '/auth-upgrade',
            queryParameters: {'returnTo': _successRoute()},
          ).toString(),
        );
      } else {
        context.go(_successRoute());
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_friendlySubmitError(error)),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _successRoute() {
    if (widget.source == 'qimen-upgrade') {
      final threadId = (widget.threadId ?? '').trim();
      if (threadId.isNotEmpty) {
        return Uri(
          path: '/master-reply',
          queryParameters: {'threadId': threadId},
        ).toString();
      }
      return '/master-reply';
    }
    return '/today';
  }

  String _normalizedDateInput() {
    final raw = _dobController.text.trim();
    if (raw.isEmpty) return _formatDate(_dob);

    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return '';
    _dob = DateTime(parsed.year, parsed.month, parsed.day);
    final normalized = _formatDate(_dob);
    _dobController.text = normalized;
    return normalized;
  }

  String _normalizedTimeInput() {
    final raw = _tobController.text.trim();
    if (raw.isEmpty) return _formatTime(_tob);

    final parts = raw.split(':');
    if (parts.length != 2) return '';
    final hour = int.tryParse(parts.first);
    final minute = int.tryParse(parts.last);
    if (hour == null || minute == null) return '';
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
    _tob = TimeOfDay(hour: hour, minute: minute);
    final normalized = _formatTime(_tob);
    _tobController.text = normalized;
    return normalized;
  }

  String _friendlySubmitError(Object error) {
    final message = error.toString().replaceFirst('Exception: ', '').trim();
    if (message.isEmpty) {
      return 'Your profile could not be created right now. Please try again.';
    }
    return message;
  }

  bool get _rebuildMode => widget.mode == 'rebuild';
  bool get _editMode => widget.mode == 'edit';
  bool get _profileCorrectionMode => _rebuildMode || _editMode;
  bool get _qimenUpgradeMode => widget.source == 'qimen-upgrade';
  bool get _requiresSignupStep => !_profileCorrectionMode;

  String get _screenTitle {
    if (_qimenUpgradeMode) return 'Unlock Your Personal Chart';
    if (_rebuildMode) return 'Refresh Your Energy Profile';
    if (_editMode) return 'Update Your Birth Details';
    return 'Create Your Energy Profile';
  }

  String get _heroEyebrow =>
      _qimenUpgradeMode ? 'PERSONAL CHART' : 'PROFILE SETUP';

  String get _heroTitle {
    if (_qimenUpgradeMode) return 'Unlock your personal chart';
    if (_rebuildMode) return 'Refresh your energy profile';
    if (_editMode) return 'Update your birth details';
    return 'Create your energy profile';
  }

  String get _heroBody {
    if (_qimenUpgradeMode) {
      return 'Add your birth details to unlock daily suggestions, longer-range timing, and more individualized guidance on top of your Qimen readings.';
    }
    if (_rebuildMode) {
      return 'Confirm your real birth details one more time so Oraya can rebuild your profile correctly.';
    }
    if (_editMode) {
      return 'If any part of your original birth details was off, enter the corrected version here and Oraya will rebuild your chart.';
    }
    return 'Enter your birth details to unlock your personal chart and deeper long-range guidance.';
  }

  String get _heroPrivacyLine {
    if (_qimenUpgradeMode) {
      return 'Your details stay encrypted and are used only to build the chart layer behind your experience.';
    }
    return 'Your details are encrypted and stored only as the minimum profile information needed to continue your experience.';
  }

  String get _submitLabel {
    if (_submitting) {
      if (_profileCorrectionMode) return 'Refreshing your profile...';
      return 'Updating your profile...';
    }
    if (_profileCorrectionMode) return 'Update';
    return 'Update and Sign Up';
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _dobController.dispose();
    _tobController.dispose();
    _birthplaceController.dispose();
    _birthplaceFocus.dispose();
    super.dispose();
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
        title: Text(_screenTitle),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(22),
            decoration: cosmicHeroDecoration(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _heroEyebrow,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.9,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _heroTitle,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    height: 1.12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _heroBody,
                  style: const TextStyle(color: Colors.white70, height: 1.45),
                ),
                const SizedBox(height: 10),
                Text(
                  _heroPrivacyLine,
                  style: const TextStyle(
                    fontSize: 12,
                    height: 1.45,
                    color: Colors.white60,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _dobController,
            keyboardType: TextInputType.datetime,
            decoration: InputDecoration(
              labelText: 'Birth date',
              hintText: 'YYYY-MM-DD',
              suffixIcon: IconButton(
                onPressed: _pickDate,
                icon: const Icon(Icons.calendar_month),
              ),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _tobController,
            keyboardType: TextInputType.datetime,
            decoration: InputDecoration(
              labelText: 'Birth time (optional)',
              hintText: 'HH:MM',
              suffixIcon: IconButton(
                onPressed: _pickTimeWheel,
                icon: const Icon(Icons.schedule),
              ),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _gender,
            decoration: const InputDecoration(
              labelText: 'Gender (optional)',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(value: 'female', child: Text('Female')),
              DropdownMenuItem(value: 'male', child: Text('Male')),
              DropdownMenuItem(value: 'non-binary', child: Text('Non-binary')),
              DropdownMenuItem(
                  value: 'prefer-not-to-say', child: Text('Prefer not to say')),
            ],
            onChanged: (v) => setState(() => _gender = v),
          ),
          const SizedBox(height: 12),
          TextField(
            focusNode: _birthplaceFocus,
            controller: _birthplaceController,
            onChanged: _onBirthplaceChanged,
            decoration: InputDecoration(
              labelText: 'Birth city',
              hintText: 'Type your city',
              border: const OutlineInputBorder(),
              suffixIcon: _isLoadingCities
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  : const Icon(Icons.public),
            ),
          ),
          if (_citySuggestions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: CosmicPalette.cream,
                border: Border.all(color: CosmicPalette.line),
                borderRadius: BorderRadius.circular(16),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _citySuggestions.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final item = _citySuggestions[i];
                  return ListTile(
                    dense: true,
                    title: Text(item),
                    onTap: () {
                      _birthplaceController.text = item;
                      _birthplaceFocus.unfocus();
                      setState(() => _citySuggestions = []);
                    },
                  );
                },
              ),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: Text(_submitLabel),
          ),
          const SizedBox(height: 10),
          Text(
            _qimenUpgradeMode
                ? 'Birth date, time, and city are used to build your personal chart layer. Unknown birth time is okay if you do not have it.'
                : 'Birth date, time, and city are used to generate your chart and initialize your encrypted profile.',
            style: const TextStyle(
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

import 'package:supabase_flutter/supabase_flutter.dart';

class ApiClient {
  final _supabase = Supabase.instance.client;

  Future<void> _reportClientIncident({
    required String functionName,
    required int status,
    Object? data,
    Object? requestBody,
  }) async {
    if (functionName == 'member-client-incidents') return;

    try {
      await ensureSignedIn();
      await _supabase.functions.invoke(
        'member-client-incidents',
        body: {
          'incident_type': 'client_function_failure',
          'function_name': functionName,
          'status': status,
          'message': _describeFunctionFailure(
            functionName: functionName,
            status: status,
            data: data,
          ),
          'request_body': requestBody,
          'response_data': data,
          'client_context': {
            'platform': 'flutter_app',
          },
        },
      );
    } catch (_) {
      // Incident reporting should never block the original user flow.
    }
  }

  Future<void> ensureSignedIn() async {
    final session = _supabase.auth.currentSession;
    final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final isExpired =
        session?.expiresAt != null && session!.expiresAt! <= nowSeconds;

    if (session != null && !isExpired) return;

    if (session != null && isExpired) {
      await _supabase.auth.signOut();
    }

    await _supabase.auth.signInAnonymously();
  }

  Future<FunctionResponse> _invokeWithSessionRetry(
    String functionName, {
    Object? body,
  }) async {
    await ensureSignedIn();

    var result = await _supabase.functions.invoke(functionName, body: body);
    final invalidSession = result.status == 401 ||
        result.status == 403 ||
        (result.data is Map &&
            (((result.data as Map)['error'] ?? '')
                .toString()
                .contains('Invalid or expired token')));

    if (invalidSession) {
      await _supabase.auth.signOut();
      await _supabase.auth.signInAnonymously();
      result = await _supabase.functions.invoke(functionName, body: body);
    }

    if (result.status >= 400) {
      await _reportClientIncident(
        functionName: functionName,
        status: result.status,
        data: result.data,
        requestBody: body,
      );
    }

    return result;
  }

  Future<Map<String, dynamic>> saveProfileAndChart({
    required String dob,
    String? tob,
    String? gender,
    required String birthplace,
    required String timezone,
    String? intent,
    String language = 'en',
  }) async {
    final result = await _invokeWithSessionRetry(
      'save-profile-and-chart',
      body: {
        'dob': dob,
        'tob': tob,
        'gender': gender,
        'birthplace': birthplace,
        'timezone': timezone,
        'intent': intent,
        'language': language,
      },
    );

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'save-profile-and-chart',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> fetchDailyGuidance({
    required String date,
    required String timezone,
  }) async {
    final result = await _invokeWithSessionRetry(
      'daily-guidance',
      body: {'date': date, 'timezone': timezone},
    );

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'daily-guidance',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> fetchFirstImpression() async {
    final result = await _invokeWithSessionRetry('first-impression');

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'first-impression',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> fetchFirstImpressionDebug({
    String? userId,
  }) async {
    final result = await _invokeWithSessionRetry(
      'first-impression-debug',
      body: userId == null || userId.trim().isEmpty
          ? const {}
          : {
              'user_id': userId.trim(),
            },
    );

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'first-impression-debug',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> fetchWallet() async {
    final result = await _invokeWithSessionRetry('user-wallet');
    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'user-wallet',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> previewChart({
    required String dob,
    String? tob,
    String? gender,
    required String birthplace,
    required String timezone,
  }) async {
    final result = await _invokeWithSessionRetry(
      'chart-preview',
      body: {
        'dob': dob,
        'tob': tob,
        'gender': gender,
        'birthplace': birthplace,
        'timezone': timezone,
      },
    );

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'chart-preview',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> previewQimen({
    required String submittedAt,
    required String timezone,
    String systemProfile = 'chai_bu',
  }) async {
    final result = await _invokeWithSessionRetry(
      'qimen-preview',
      body: {
        'submitted_at': submittedAt,
        'timezone': timezone,
        'system_profile': systemProfile,
      },
    );

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'qimen-preview',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<List<Map<String, dynamic>>> fetchQuestionThreads() async {
    final result = await _invokeWithSessionRetry('question-threads');
    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'question-threads',
        status: result.status,
        data: result.data,
      ));
    }

    final map = Map<String, dynamic>.from(result.data as Map);
    final threads = (map['threads'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    return threads;
  }

  Future<List<Map<String, dynamic>>> fetchMemberDailyMessages() async {
    final result = await _invokeWithSessionRetry('member-daily-messages');
    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'member-daily-messages',
        status: result.status,
        data: result.data,
      ));
    }

    final map = Map<String, dynamic>.from(result.data as Map);
    return (map['messages'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<Map<String, dynamic>> claimShareReward({
    String? channel,
    String? targetHint,
    String? shareResult,
    String? requestId,
  }) async {
    final result = await _invokeWithSessionRetry(
      'share-oraya',
      body: {
        'channel': channel,
        'target_hint': targetHint,
        'share_result': shareResult,
        'request_id': requestId,
      },
    );
    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'share-oraya',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<void> toggleMemberDailyMessageFavorite({
    required String messageId,
    required bool favorite,
  }) async {
    final result = await _invokeWithSessionRetry(
      'member-daily-messages',
      body: {
        'action': 'toggle_favorite',
        'message_id': messageId,
        'favorite': favorite,
      },
    );
    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'member-daily-messages',
        status: result.status,
        data: result.data,
      ));
    }
  }

  Future<void> markMemberDailyMessageRead({
    required String messageId,
    bool read = true,
  }) async {
    final result = await _invokeWithSessionRetry(
      'member-daily-messages',
      body: {
        'action': 'mark_read',
        'message_id': messageId,
        'read': read,
      },
    );
    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'member-daily-messages',
        status: result.status,
        data: result.data,
      ));
    }
  }

  Future<Map<String, dynamic>> submitMasterQuestion({
    required String question,
    required String category,
    required String questionKind,
    String priority = 'normal',
    String? parentQuestionId,
    String? requestId,
    String divinationSystem = 'qimen_yang',
    String? divinationProfile,
    String? submittedAt,
    String? timezone,
  }) async {
    final result = await _invokeWithSessionRetry(
      'master-reply-submit',
      body: {
        'question_text': question,
        'category': category,
        'question_kind': questionKind,
        'priority': priority,
        'parent_question_id': parentQuestionId,
        'request_id': requestId,
        'divination_system': divinationSystem,
        'qimen_system_profile': divinationProfile,
        'submitted_at': submittedAt,
        'timezone': timezone,
      },
    );

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'master-reply-submit',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> fetchMemberQimenFeedback({
    required String threadId,
  }) async {
    final result = await _invokeWithSessionRetry(
      'member-qimen-feedback',
      body: {
        'action': 'get',
        'thread_id': threadId,
      },
    );

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'member-qimen-feedback',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  Future<Map<String, dynamic>> submitMemberQimenFeedback({
    required String threadId,
    required String verdict,
    required String userFeedback,
  }) async {
    final result = await _invokeWithSessionRetry(
      'member-qimen-feedback',
      body: {
        'action': 'submit',
        'thread_id': threadId,
        'verdict': verdict,
        'user_feedback': userFeedback,
      },
    );

    if (result.status != 200) {
      throw Exception(_describeFunctionFailure(
        functionName: 'member-qimen-feedback',
        status: result.status,
        data: result.data,
      ));
    }

    return Map<String, dynamic>.from(result.data as Map);
  }

  String _describeFunctionFailure({
    required String functionName,
    required int status,
    Object? data,
  }) {
    String? nestedMessage(Object? value) {
      if (value is Map) {
        final map = Map<String, dynamic>.from(value);
        final direct = map['message']?.toString().trim();
        if (direct != null && direct.isNotEmpty) return direct;
        if (map['error'] != null) return nestedMessage(map['error']);
        final reason = map['reason']?.toString().trim();
        if (reason != null && reason.isNotEmpty && reason != 'null') {
          return reason;
        }
      }
      return null;
    }

    if (status == 404) {
      return 'The setup service is currently unavailable. Please try again in a moment.';
    }

    if (status == 401 || status == 403) {
      return 'Your session could not be verified. Please reopen the app and try again.';
    }

    if (status == 400) {
      final message = nestedMessage(data);
      if (message != null && message.isNotEmpty) return message;
      return 'Your profile could not be created right now. Please try again in a moment.';
    }

    final message = nestedMessage(data);
    if (message != null && message.isNotEmpty) return message;

    final detail = data?.toString().trim();
    if (detail == null || detail.isEmpty || detail == 'null') {
      return '$functionName is temporarily unavailable.';
    }

    return detail;
  }
}

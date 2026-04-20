import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

class ShareService {
  ShareService._();

  static const shareTitle = 'Oraya';
  static const shareBody =
      'I have been using Oraya for private guidance on love, work, timing, and next moves. Take a look at Oraya if you want a more personal kind of reading.';

  static Future<ShareResult> shareOraya(BuildContext context) async {
    final renderObject = context.findRenderObject();
    final box = renderObject is RenderBox ? renderObject : null;

    return SharePlus.instance.share(
      ShareParams(
        title: shareTitle,
        subject: shareTitle,
        text: shareBody,
        sharePositionOrigin:
            box == null ? null : box.localToGlobal(Offset.zero) & box.size,
        downloadFallbackEnabled: false,
      ),
    );
  }
}

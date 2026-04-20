# WenZeng OCR Notes

## Scope

- source pdf: `/Volumes/Hard Drive/文曾盲派独门绝技40集/001文曾盲派独立绝技内部资料.pdf`
- sample pages OCRed: 1-50
- sidecar text: [wenzeng-sample-1-50.txt](/Users/liheng/Desktop/cosmic-daily-app/data/wenzeng-sample-1-50.txt)
- full OCR text: [wenzeng-full.txt](/Users/liheng/Desktop/cosmic-daily-app/data/wenzeng-full.txt)
- full OCR pdf: [wenzeng-full.ocr.pdf](/Users/liheng/Desktop/cosmic-daily-app/data/wenzeng-full.ocr.pdf)

## OCR Quality

The OCR is usable for:

- chapter discovery
- terminology extraction
- rule drafting
- teacher-specific glossary building

The OCR is not yet reliable enough for:

- exact quotation
- direct publication
- blind automatic merging into canonical rules without review

## Recurring OCR / Print Issues

- `言派` -> likely `盲派`
- `赋神` -> likely `贼神`
- `已火` -> often `巳火`
- `成土` -> often `戌土`
- `展土` -> often `辰土`
- `于水` / `王水` -> often `壬水`
- `有油制` -> likely `有泄制`
- `无死不成格局` -> likely `无制不成格局`

## Confirmed High-Value Concepts

- 势
- 党 / 会党
- 叛党
- 制
- 贼捕结构
- 功神 / 辅神 / 废神
- 正向做功 / 反向做功
- 月令同党
- 食伤生财
- 化官生印

## Full OCR Highlights

- high-frequency concepts confirmed in full OCR:
  - `格局`
  - `做功`
  - `食伤生财`
  - `月令`
  - `化官生印`
  - `用神`
  - `会党`
  - `成势`
  - `贼捕结构`
- key sections confirmed:
  - `正局与反局`
  - `正用与反用`
  - `四墓库高级象法`
  - `做功效率-合制效率`
  - `做功效率-刑冲穿制效率`
  - `专论用神`
  - `专论月令`

## Draft Output Created

Draft cards were added under:

- [teacher-wenzeng](/Users/liheng/Desktop/cosmic-daily-app/data/reviewed-rules/ingestion-drafts/teacher-wenzeng)

## Recommended Next Step

The full OCR is complete. The next pass should focus on:

1. continuing phrase-level correction pairs from reviewed chapters
2. merging approved draft cards into canonical knowledge files
3. turning chapter rules into prompt-ready retrieval snippets
4. adding a lightweight reviewer UI for accepting or editing draft cards

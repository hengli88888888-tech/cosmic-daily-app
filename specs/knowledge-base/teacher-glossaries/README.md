# Teacher Glossaries

Each file in this folder stores terminology overrides or additions for one teacher.

File naming rule:

- use the same slug logic as the ingestion tool
- example: `li-shunxiang.json`

Suggested contents:

```json
{
  "teacher": "Li Shunxiang",
  "whisper_hint_terms": ["某位老师常说的术语"],
  "canonical_terms": [
    {
      "canonical": "某标准术语",
      "aliases": ["老师口头简称"]
    }
  ],
  "common_corrections": [
    {
      "wrong": "转写常错词",
      "correct": "正确术语"
    }
  ]
}
```

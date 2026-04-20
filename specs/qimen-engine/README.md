# QiMen Engine Rules

This folder stores structured assets for the future Yang Dun QiMen chart plugin.

The goal is to keep calculation mappings out of ad-hoc code and make the rule profile explicit.

Current files:

- `engine-profile.json`
- `yang-dun-rules.json`
- `yin-dun-rules.json`
- `palace-layout.json`
- `output-schema.example.json`
- `mqimen-oracle-profile.json`
- `china95-oracle-profile.json`

Current implementation status:

- hidden preview route exists at `/qimen-test`
- backend preview function exists as `qimen-preview`
- current runnable profiles are `yang_dun_v1_chai_bu` and `yin_dun_v1_chai_bu`
- primary compatibility target is `mQimen.app` in `拆补` mode
- secondary oracle target is `china95.net/qimen_show.asp`
- oracle-backed `置闰` preview is available as `zhi_run`
- product casting basis is now `device local civil time` rather than true-solar correction
- `chai_bu` `阴遁` is now supported
- `zhi_run` `阴遁` remains pending
- `web_style_layout` is the preferred human-readable plate layout for audit/replay
- `china95_style_layout` remains as a backward-compatible alias

Oracle policy:

- `mQimen.app` may be used as a validation oracle and behavior reference
- `china95.net` may be used as a secondary validation oracle, especially for `拆补 / 排盘结构 / 结果页字段`
- it should not be treated as the direct implementation source
- the exact production choice between `拆补` and `置闰` is still pending course-derived evidence

# china95 奇门排盘调查

## 结论

`https://www.china95.net/paipan/qimen/` 不是纯前端黑盒。它背后至少有两套表单链：

- 新版入口：`/paipan/qimen/`
- 老版可脚本化入口：`/paipan/qimen.asp -> /paipan/qimen_show.asp`

当前最稳定、最适合做脚本对照的是老版 `qimen_show.asp`。

## 已确认的字段

### 老版表单 `qimen.asp`

表单 action：

- `qimen_show.asp`

主要字段：

- `years`
- `months`
- `days`
- `hours`
- `mins`
- `miao`
- `ju`
- `R1`
- `D1`
- `T1`
- `button1=排盘`

时间模式 `R1`：

- `V1`：按北京时间起局
- `V2`：按选择地区起真太阳时局
- `V3`：按选择经度起真太阳时局

局数字段 `ju`：

- `拆补局`
- `阳1` ... `阳9`
- `阴1` ... `阴9`

### 新版表单 `qimen/`

主要字段：

- `mod`
- `PPfangshi`
- `PPfanghua`
- `y`
- `m`
- `d`
- `h`
- `min`
- `Nian`
- `Yue`
- `Ri`
- `Shi`
- `Ju`

已确认文本标签：

- `PPfangshi=1`：转盘奇门
- `PPfangshi=0`：飞盘奇门
- `PPfanghua=0`：拆补无闰法
- `PPfanghua=1`：超接置闰法

## 已确认的可脚本化请求

对 `qimen_show.asp` 提交如下 payload 可以稳定返回结果页：

- `R1=V2`
- `years=2024`
- `months=2`
- `days=10`
- `hours=12`
- `mins=0`
- `miao=0`
- `ju=拆补局`
- `D1=北京`
- `button1=排盘`

结果页可提取：

- 经度
- 真时
- 公元时间
- 农历时间
- 节气边界
- 干支
- 旬空
- 直符
- 直使
- 旬首
- 九宫盘文本

## 现阶段对照策略

当前建议：

- `mQimen.app`
  - 作为主 oracle
  - 尤其用于 `置闰`
- `china95`
  - 作为次级 oracle
  - 优先用于 `拆补 / 真太阳时 / 结果页字段校验`

当前不要做的事：

- 不要把 `china95` 直接当成 `置闰` 的主真值来源
- 不要把它的页面脚本或 HTML 结构直接嵌进我们的引擎

## 和课程录入的关系

关于“拆补什么时候用，置闰什么时候用”，当前仍未锁死成产品规则。

现阶段处理方式：

- 先让引擎支持两套 profile
- 先用 `mQimen + china95` 做双对照
- 再从即将录入的奇门课程里抽取：
  - `拆补`
  - `置闰`
  - `超接`
  - `转盘`
  - `飞盘`
 相关片段，反推出老师实际采用的规则边界

这意味着：

- `oracle alignment` 先行
- `profile selection rule` 后续由课程证据收口

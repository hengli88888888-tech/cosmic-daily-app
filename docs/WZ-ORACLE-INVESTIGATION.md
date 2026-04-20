# 问真八字对照源调查笔记

主对照站点：
- [问真八字在线排盘](https://pcbz.iwzwh.com/#/paipan/index)

## 已确认的接口

主排盘接口：

```text
https://bzapi4.iwzbz.com/getbasebz8.php
```

已确认参数：
- `d`: 出生时间，格式如 `2024-02-10 12:00`
- `s`: 性别，`1 = 男`，`0 = 女`
- `today`: 页面当前时间；当前看起来不是四柱主计算输入
- `vip`: 默认 `0`
- `userguid`: 为空也可返回结果
- `yzs`: 当前默认页抓到的是 `0`

## 已确认的返回结构

`bz` 的柱位映射：
- `bz[0] + bz[1]` => 年柱
- `bz[2] + bz[3]` => 月柱
- `bz[4] + bz[5]` => 日柱
- `bz[6] + bz[7]` => 时柱
- `bz[8]` => 农历标签

示例：

```json
{
  "bz": {
    "0": "甲",
    "1": "辰",
    "2": "丙",
    "3": "寅",
    "4": "甲",
    "5": "辰",
    "6": "庚",
    "7": "午"
  }
}
```

对应四柱：

```text
甲辰 / 丙寅 / 甲辰 / 庚午
```

## 浏览器层已确认的行为

### 默认页
- 默认排盘请求会直接调用 `getbasebz8.php`
- 默认 `yzs = 0`
- 默认出生地址是 `未知地 北京时间 --`
- 默认经纬显示为 `北纬39.00 东经120.00`

### 海外地址选择器
已确认页面存在海外地址流程：
- `国内 / 海外`
- 国家列表显示固定 `GMT` 偏移，如 `美国GMT-5`
- 地区列表显示如 `纽约`
- 还有一个 `换算北京时间(默认关闭)` 的额外选项

当前结论：
- 问真八字前端并不是直接以 `IANA tzdb + 地点经纬` 作为唯一入口
- 它至少在海外页使用了“国家 GMT 偏移 + 地区 + 是否换算北京时间”的前端口径
- 这与我们当前自研引擎使用的 `IANA tzdb + 真太阳时 + DST` 是两套不同的时间归一化模型

## 当前对照结论

已确认：
- 你提供的部分 30 例样本，与问真八字主排盘接口返回结果并不一致
- 所以现阶段需要先统一“唯一真值来源”

进一步确认：
- 以默认 `yzs=0` 直接对照时，问真八字与我们的本地引擎在现代本地样本上已经可以对齐四柱主干
- 对于成都、广州、上海这类本地样本，只要把“真太阳时修正后的本地时间”直接作为 `d` 传给 `getbasebz8.php`，问真八字就会和我们的引擎对齐
- 在这套产品口径下，我们当前已经做到 `29 / 30` 的四柱一致
- 这说明问真八字的“真太阳时模式”核心上是**前端先改时间，再调用排盘接口**
- `2024-03-05 23:30` 这类子时边界样本，如果先用真太阳时修正，会落回 `22:54`，问真和我们的引擎都不会进入子时；因此这条不再是引擎误差，而是旧样本口径问题
- 唯一剩余差异是海外样本 `029 (Rio de Janeiro)`：问真如果直接接收 `08:02` 的本地真太阳时，会给出 `戊午月`；但如果先把这同一个时刻换成北京时间 `19:02` 再喂给问真，就会切成 `己未月`
- 这说明问真海外页至少在某些路径上存在“北京时间语义”转换层，不能把裸 API 的 `d` 参数简单等同于“海外本地民用/真太阳时间”
- 进一步验证后可以确认：如果把所有海外样本都强行改成“北京时间语义”再喂给问真，`月柱` 边界问题会改善，但 `日柱 / 时柱` 会整体漂移
- 因此这个“北京时间语义”模式只能作为**海外页机制诊断工具**，不能作为我们的产品真值，也不能替代 `local_true_solar` 产品口径

建议流程：
1. 以问真八字作为主对照源
2. 校对时必须先统一设置：
   - 是否先把出生时间换成真太阳时
   - 是否启用 `23:00 起换日`
3. 先校四柱，不先校神煞
4. 先统一：
   - 年柱分界
   - 月柱节气分界
   - 日柱真值
   - 23:00 子时换日
5. 再继续校：
   - 空亡
   - 纳音
   - 起运
   - 神煞

## 对照脚本

脚本：
- [/Users/liheng/Desktop/cosmic-daily-app/scripts/verify_against_wz_oracle.mjs](/Users/liheng/Desktop/cosmic-daily-app/scripts/verify_against_wz_oracle.mjs)

用法：

```bash
node /Users/liheng/Desktop/cosmic-daily-app/scripts/verify_against_wz_oracle.mjs
```

同时对照本地引擎：

```bash
INCLUDE_LOCAL=1 node /Users/liheng/Desktop/cosmic-daily-app/scripts/verify_against_wz_oracle.mjs
```

用产品口径对照：

```bash
INCLUDE_LOCAL=1 WZ_INPUT_MODE=local_true_solar node /Users/liheng/Desktop/cosmic-daily-app/scripts/verify_against_wz_oracle.mjs
```

用海外页北京时间语义做诊断：

```bash
INCLUDE_LOCAL=1 WZ_INPUT_MODE=local_true_solar_beijing node /Users/liheng/Desktop/cosmic-daily-app/scripts/verify_against_wz_oracle.mjs
```

只跑前 5 例：

```bash
CASE_LIMIT=5 node /Users/liheng/Desktop/cosmic-daily-app/scripts/verify_against_wz_oracle.mjs
```

当前生成的基准文件：

- `/Users/liheng/Desktop/cosmic-daily-app/specs/chart-engine/wz-oracle-baseline.raw.json`
- `/Users/liheng/Desktop/cosmic-daily-app/specs/chart-engine/wz-oracle-baseline.product.json`

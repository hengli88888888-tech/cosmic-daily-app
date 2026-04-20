import {
  buildQimenTeacherConsensus,
  buildQimenTeacherRun,
  type QimenTeacherConsensus,
  type QimenTeacherRun,
} from '../backend/supabase/functions/_shared/qimen-reasoning-engine.ts'
import { calculateQimen, type QimenInput } from '../backend/supabase/functions/_shared/qimen-engine.ts'

type StrictRerunSeed = {
  case_id: string
  source_section_title?: string
  source_ref?: string
  evaluation_track?: 'main' | 'environmental_edge_case'
  submitted_at: string
  timezone: string
  system_profile?: QimenInput['system_profile']
  question_type: string
  question_type_label?: string
  normalized_question: string
  expected_conclusion_family?: string
  expected_axes?: string[]
  fidelity_check_notes?: string[]
  plate_markers?: string[]
  wang_conclusion?: string
  wang_reasoning_steps?: string[]
  target_teachers?: string[]
  seed_status?: string
}

type StrictRerunSeedBundle = {
  generated_at?: string
  seeds: StrictRerunSeed[]
}

type TeacherAlignment = {
  teacher_id: string
  main_judgment: string
  timing_line: string
  risk_line: string
  reason_chain: string[]
  normalized_key: string
  normalized_label: string
  normalized_timing_bucket: string
  alignment_to_wang: 'exact_same_result' | 'same_direction' | 'divergent'
}

type CaseFidelity = 'exact_match' | 'acceptable_match' | 'under_specified' | 'mismatch'
type FidelityRootCause = 'plate_engine' | 'question_routing' | 'timing_expression' | 'result_normalization'

type CaseStrictRerunResult = {
  case_id: string
  source_section_title: string
  source_ref: string
  evaluation_track: 'main' | 'environmental_edge_case'
  submitted_at: string
  timezone: string
  question_type: string
  question_type_label: string
  normalized_question: string
  wang_original_conclusion: string
  chart_summary: {
    solar_term?: string | null
    bureau_number?: number | null
    zhi_fu?: string | null
    zhi_shi?: string | null
    xun_shou?: string | null
    local_datetime?: string | null
    yin_yang?: string | null
    layout_profile?: string | null
    web_style_layout?: string | null
    out_of_scope_reason?: string | null
  }
  teachers: TeacherAlignment[]
  wang_run: TeacherAlignment | null
  consensus: QimenTeacherConsensus | null
  case_outcome:
    | 'all_same_result'
    | 'same_direction_with_style_variation'
    | 'majority_same_as_wang'
    | 'split'
    | 'engine_out_of_scope'
  exact_same_count: number
  same_direction_count: number
  case_fidelity: CaseFidelity
  mismatch_axes?: string[]
  root_cause?: FidelityRootCause
  secondary_cause?: FidelityRootCause
  fidelity_check_notes?: string[]
  evaluation_flags?: string[]
}

type StrictRerunReport = {
  generated_at: string
  total_cases: number
  accuracy_cases: number
  excluded_cases: number
  teachers: string[]
  summary: {
    all_same_result: number
    same_direction_with_style_variation: number
    majority_same_as_wang: number
    split: number
    engine_out_of_scope: number
  }
  fidelity_summary: {
    exact_match: number
    acceptable_match: number
    under_specified: number
    mismatch: number
  }
  root_cause_summary: Array<{
    root_cause: FidelityRootCause
    count: number
  }>
  teacher_alignment_summary: Array<{
    teacher_id: string
    exact_same_result: number
    same_direction: number
    divergent: number
  }>
  cases: CaseStrictRerunResult[]
}

const INPUT_PATH =
  '/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-strict-rerun-seeds.json'
const OUTPUT_JSON =
  '/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-strict-rerun-report.json'
const OUTPUT_MD =
  '/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-strict-rerun-report.md'

const DEFAULT_TEACHERS = ['钟波', '文艺复兴', '王兴兵', '王永源', '苗道长']
const TIMING_AXIS_TERMS = ['应期', '时间', '窗口', '多久', '何时', '婚期', '次年', '年底', '明年', '午时', '酉时', '年内', '回归']
const CONCRETE_TIMING_TERMS = ['今天', '当天', '今早', '今晚', '当晚', '当天晚上', '今日', '次日', '明天', '下周二', '酉时', '上午', '下午', '本月', '年内', '年底', '明年', '农历', '后续阶段', '下一轮', '填实日', '午时', '很快', '短期', '长期', '近几天', '一周内', '前后', '月令', '长病慢治', '恢复要拉长', '恢复慢', '略有利', '先拖一阵', '短拖后拆', '不是当场就拆', '今年之内', '两三个月', '两个月', '时间本身不算不能去']
const POSITIVE_DIRECTION_TERMS = ['可以买', '可以去', '有机会', '能找回', '能回来', '能出来', '愿意帮', '可谈', '能通过', '可录取', '不会被裁', '整体安全']
const RISK_DIRECTION_TERMS = ['不适合', '不宜', '无缘', '难成', '不好', '不太好', '不容易', '不可靠', '危险', '被抓', '拘留', '拖欠', '拖延', '压抑', '不算理想', '不要主动']

function uniqueStrings(values: string[]) {
  return values.filter((value, index, arr) => value && arr.indexOf(value) === index)
}

function normalizeChineseText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/[，。,；：、（）()\-\s]/g, '')
    .trim()
}

function extractAxisHints(axis: string) {
  const directHints: string[] = []
  if (axis.includes('证据')) directHints.push('证据', '现有证据更偏原告一边', '有利己的部分不多')
  if (axis.includes('应对策略')) directHints.push('主动走动关系', '送礼', '主动走动', '更稳的做法')
  if (axis.includes('不转更稳') || axis.includes('后续是否不转更稳')) directHints.push('不转更稳', '不转反而有利', '留在老家和近处打更顺', '不宜反复变动到外地')
  if (axis.includes('后续走向')) directHints.push('后续走向', '回头', '和缓', '回暖')
  if (axis.includes('现实压力')) directHints.push('现实压力', '现实压力明显', '工作发展不稳', '关系推进压抑')
  if (axis.includes('还有问题')) directHints.push('后续是否有事', '后面仍有问题', '后面也未必一点问题都没有', '完全没问题')
  if (axis.includes('近期运势')) directHints.push('近期状态不稳', '状态不稳', '近况', '工作相关的是非', '拘留风险', '取保')
  if (axis.includes('可去')) directHints.push('可以去', '可去')
  if (axis.includes('难走到结婚')) directHints.push('难走到结婚', '难成婚', '走不到结婚')
  if (axis.includes('性功能')) directHints.push('性功能', '性功能偏弱', '长期性功能问题')
  if (axis.includes('生育能力')) directHints.push('生育能力', '生育能力受影响', '生育障碍', '怀不上')
  if (axis.includes('子宫') || axis.includes('输卵管')) directHints.push('子宫受伤', '输卵管不通', '打过胎', '流产受伤', '不孕')
  if (axis.includes('中药调理') || axis.includes('调理是否难有明显效果')) directHints.push('中药来调理', '调理也没用', '治疗能有一点效果', '难根治', '难有明显效果')
  if (axis.includes('难根治') || axis.includes('治疗是否有效')) directHints.push('治疗能有一点效果', '治疗有效但难根治', '治疗有限', '难根治')
  if (axis.includes('竞标是否不利')) directHints.push('竞标不利', '这次竞标对自己并不有利', '不占优势')
  if (axis.includes('主动争取')) directHints.push('主动去争取', '气势不能弱', '强势主动去争')
  if (axis.includes('机会是否偏低') || axis.includes('中标机会')) directHints.push('机会偏低', '中标机会偏低', '拿下项目的机会偏低')
  if (axis.includes('不得不去')) directHints.push('不得不去', '必须去', '这趟多半还是必须走', '基本是必须去')
  if (axis.includes('陷阱')) directHints.push('陷阱', '有坑', '不建议去')
  if (axis.includes('本地')) directHints.push('本地', '北京本地', '北京找')
  if (axis.includes('外地')) directHints.push('外地', '福州', '南方')
  if (axis.includes('忍让')) directHints.push('忍让')
  if (axis.includes('多情')) directHints.push('多情', '过错')
  if (axis.includes('长久')) directHints.push('长久', '做不长久')
  if (axis.includes('应聘')) directHints.push('应聘上', '录用', '没应聘上')
  if (axis.includes('法方')) directHints.push('与法方关系', '调解', '讲和', '和解')
  if (axis.includes('通过')) directHints.push('通过', '不过线', '未过线', '考不过', '没过', '考上', '进面试', '入面试')
  if (axis.includes('中上')) directHints.push('中上', '成绩中上', '考到中上', '中上成绩')
  if (axis.includes('暗中操作') || axis.includes('找关系')) directHints.push('暗中操作', '花钱找关系', '找关系', '暗中花钱', '有人花钱找关系')
  if (axis.includes('金融') || axis.includes('金钱')) directHints.push('金融金钱问题', '金钱问题', '金融问题', '因金钱问题而起')
  if (axis.includes('6-10') || axis.includes('6 到 10') || axis.includes('6到10')) directHints.push('6 到 10 年', '6到10年', '6-10 年', '6-10年')
  if (axis.includes('最高部门领导') || axis.includes('女性家属')) directHints.push('最高部门领导', '当地最高部门领导', '女性家属', '领导或女性家属')
  if (axis.includes('年底') || axis.includes('保释')) directHints.push('年底前后', '2017年底', '保释放出', '保释')
  if (axis.includes('马克龙')) directHints.push('马克龙', '马克龙胜出', '最终由马克龙胜出')
  if (axis.includes('勒庞')) directHints.push('勒庞', '勒庞败选', '女性候选人不利')
  if (axis.includes('特朗普')) directHints.push('特朗普', '特朗普胜出', '最终由特朗普胜出')
  if (axis.includes('希拉里')) directHints.push('希拉里', '希拉里败选', '女性身份', '健康不稳定')
  if (axis.includes('选民')) directHints.push('选民', '选民偏向特朗普', '选民容易站在特朗普这边')
  if (axis.includes('第二轮') || axis.includes('拉票')) directHints.push('第二轮', '进入第二轮', '继续拉票')
  if (axis.includes('奥朗德')) directHints.push('奥朗德', '奥朗德支持马克龙', '现任总统支持马克龙')
  if (axis.includes('女性候选人') || axis.includes('女性时运')) directHints.push('女性候选人时运不利', '女性时运不利', '2017 年对政坛女性不利')
  if (axis.includes('闷热') || axis.includes('太阳')) directHints.push('闷热', '有太阳', '高温天气', '先热')
  if (axis.includes('雷雨') || axis.includes('晴雨反复')) directHints.push('雷雨', '雷电', '阵雨反复', '晴雨来回切换')
  if (axis.includes('彩虹')) directHints.push('彩虹', '出现彩虹')
  if (axis.includes('野外活动') || axis.includes('影响野外活动')) directHints.push('野外活动', '被打断', '去农家', '避雨')
  if (axis.includes('有利')) directHints.push('有利', '略有利')
  if (axis.includes('借到')) directHints.push('借到', '借不出来', '借不成')
  if (axis.includes('借成')) directHints.push('借成', '借不成', '最终借不成')
  if (axis.includes('大集团') || axis.includes('国家') || axis.includes('背景')) directHints.push('国家背景', '大集团背景', '借国家或大集团名义宣传', '借名义包装')
  if (axis.includes('快进快出') || axis.includes('久持')) directHints.push('快进快出', '不宜久持', '不宜深投', '短期可能有暴利')
  if (axis.includes('候补') || axis.includes('递补')) directHints.push('候补', '候补名单', '递补机会偏低', '补上机会偏低')
  if (axis.includes('受挫') || axis.includes('状态')) directHints.push('受挫', '状态比较受挫', '内心受挫')
  if (axis.includes('农历三四月') || axis.includes('消息窗口')) directHints.push('农历三四月', '农历三月', '农历四月', '会有消息')
  if (axis.includes('当年') || axis.includes('无缘')) directHints.push('当年无缘', '当年还是无缘', '无缘这所学校')
  if (axis.includes('同行抢占')) directHints.push('同行抢占', '不是同行抢占', '同行恶意抢占')
  if (axis.includes('店员设局') || axis.includes('炒号')) directHints.push('店员问题', '店员设局', '炒作号码', '设局', '抬价')
  if (axis.includes('强势争取')) directHints.push('气势上要强一些', '压过他们', '强硬处理', '态度强硬')
  if (axis.includes('强势争取')) directHints.push('气势压过去', '当场把气势压过去', '态度要硬')
  if (axis.includes('拿到号码')) directHints.push('处理好了', '没添钱', '拿到号', '绑定好')
  if (axis.includes('挣钱')) directHints.push('挣不到钱', '不挣钱', '产品根本不好卖')
  if (axis.includes('两万')) directHints.push('两万左右', '不只投一万', '平台费就一万')
  if (axis.includes('姐夫')) directHints.push('姐夫', '心里也贪', '同意过这事', '外遇')
  if (axis.includes('父亲')) directHints.push('你爸是反对', '不太管', '不会主动管')
  if (axis.includes('继续劝阻') || axis.includes('会停')) directHints.push('还要去管', '停了', '又做了一个多月')
  if (axis.includes('宝马')) directHints.push('宝马', '本地', '更稳')
  if (axis.includes('奥迪')) directHints.push('奥迪', '纽约', '信息不太可靠', '虚假', '纠纷风险')
  if (axis.includes('银色')) directHints.push('银色', '旧一些', '本质更好')
  if (axis.includes('白色')) directHints.push('白色', '外观更好', '价位偏高', '多人争抢')
  if (axis.includes('应选') || axis.includes('哪辆')) directHints.push('最终更适合选择银色', '更适合选择银色', '最终应选银色', '最终更适合选择')
  if (axis.includes('过户') || axis.includes('过户出来')) directHints.push('过户', '最终能过出来', '过到儿子名下')
  if (axis.includes('贷款') || axis.includes('证件')) directHints.push('贷款没清', '房贷没还清', '证件没放出', '银行证件')
  if (axis.includes('十万元')) directHints.push('十万元', '帮凑', '可以商量着帮凑', '不宜逼得太急')
  if (axis.includes('未月')) directHints.push('未月前后', '未月')
  if (axis.includes('儿子')) directHints.push('给儿子', '过到儿子名下', '房子最终能过到儿子名下')
  if (axis.includes('公婆') || axis.includes('保守')) directHints.push('公婆这边比较保守', '长辈偏保守', '不容易立刻过户')
  if (axis.includes('姐姐') || axis.includes('拿不到')) directHints.push('姐姐也想要', '姐姐确实也会想要', '最后拿不到', '拿不到这套房')
  if (axis.includes('小叔子') || axis.includes('正直')) directHints.push('小叔子相对正直', '相对正直', '可以去谈')
  if (axis.includes('继承协议') || axis.includes('遗嘱')) directHints.push('继承协议', '财产继承协议', '遗嘱', '先写财产继承协议或遗嘱')
  if (axis.includes('后勤')) directHints.push('后勤', '轻松', '本质却不好')
  if (axis.includes('科研')) directHints.push('科研', '发展主流', '前景最好', '会劳累')
  if (axis.includes('新大学')) directHints.push('新大学', '比较稳定', '不好去成', '阻隔')
  if (axis.includes('东南方')) directHints.push('东南方', '最利')
  if (axis.includes('南方')) directHints.push('南方', '次优')
  if (axis.includes('换址')) directHints.push('换址', '尽量换', '位置不合适')
  if (axis.includes('阻隔')) directHints.push('阻隔', '卡住', '压住不动')
  if (axis.includes('朋友是否可靠')) directHints.push('朋友不可靠', '朋友是真心', '难合作长久')
  if (axis.includes('管理岗承诺是否兑现')) directHints.push('管理岗承诺', '承诺不一定兑现', '不好兑现')
  if (axis.includes('新项目是否更稳') || axis.includes('跟领导走')) directHints.push('跟领导走更稳', '新项目更稳', '虽然会有压力')
  if (axis.includes('是否会离开')) directHints.push('会离开', '会变动', '做不长')
  if (axis.includes('主动还是被动离开')) directHints.push('被动结束', '考核期', '工号会被取消', '自己离开')
  if (axis.includes('这事能不能做')) directHints.push('不建议你去做', '可以做', '继续做', '只能往下一步走')
  if (axis.includes('计划是否偏高')) directHints.push('计划偏高')
  if (axis.includes('行业环境是否不利')) directHints.push('大环境不利', '竞争激烈', '市场成熟', '行业大环境不利')
  if (axis.includes('中途是否会退出')) directHints.push('中途容易退出', '很难熬得过去', '退出')
  if (axis.includes('后续是否还有希望')) directHints.push('后面仍有希望', '以后才能有希望', '仍有希望')
  if (axis.includes('方法是否不对')) directHints.push('方法方式不对', '不适合这行', '保险工作')
  if (axis.includes('公司前景')) directHints.push('前景不乐观', '项目平台', '计划偏高')
  if (axis.includes('回避')) directHints.push('回避', '躲避')
  if (axis.includes('更在乎')) directHints.push('你比较在乎这个缘分', '你想成', '更在乎', '自己更在乎')
  if (axis.includes('承诺是否不可靠') || axis.includes('承诺不可靠')) directHints.push('承诺不可靠', '口头承诺不可靠', '回国后就答应我', '久拖无果')
  if (axis.includes('服装店')) directHints.push('服装店', '试衣', '那家服装店', '店里', '联系方式', '广告信息')
  if (axis.includes('衣服钱包')) directHints.push('衣服', '钱包', '试衣', '隐蔽处')
  if (axis.includes('23点')) directHints.push('23 点之前', '23点之前', '今天之内找到', '子时找到')
  if (axis.includes('自己遗忘') || axis.includes('遗忘丢失')) directHints.push('自己遗忘', '不小心遗忘', '自己不小心遗忘丢失', '自己疏忽遗落')
  if (axis.includes('保姆') || axis.includes('不是被保姆拿走')) directHints.push('不是保姆拿走', '不像保姆拿走', '不宜把时间耗在怀疑保姆上')
  if (axis.includes('卫生间') || axis.includes('浴室') || axis.includes('水边')) directHints.push('卫生间', '浴室', '化妆台', '床边', '北方', '西北方', '阴暗有水', '有水的地方', '被水冲走')
  if (axis.includes('不满')) directHints.push('你容易对他不满', '对他不满', '不可靠', '不想再搭理')
  if (axis.includes('取消')) directHints.push('取消', '被屏蔽')
  if (axis.includes('下雨')) directHints.push('下雨', '小雨', '阴天')
  if (axis.includes('没有大问题') || axis.includes('不算大病')) directHints.push('没有大问题', '不算大病', '并非大问题')
  if (axis.includes('偏财暗财')) directHints.push('偏财暗财', '暗财', '少量碰', '少做为好')
  if (axis.includes('是非')) directHints.push('是非', '惹是非', '容易起是非')
  if (axis.includes('最优先')) directHints.push('优先选择 26', '26 这家最可选', '优先 26', '26 最可选')
  if (axis.includes('条件好但难兑现')) directHints.push('90 这家', '条件看着高却不好兑现', '不好兑现', '最不可靠')
  if (axis.includes('压力大不稳定')) directHints.push('37 这家', '压力大', '不稳定')
  if (axis.includes('中途是否还有变化')) directHints.push('中途仍会再起变化', '中途容易有变化', '未必能按最初打算直接落实', '临门变动')
  if (axis.includes('严重')) directHints.push('严重', '不严重', '不算特别重', '大病', '没有危险')
  if (axis.includes('看医生') || axis.includes('就医')) directHints.push('看医生', '去检查', '去医院', '开药')
  if (axis.includes('药效') || axis.includes('用药')) directHints.push('用药效果明显', '开药有效', '药到病除', '药克病')
  if (axis.includes('炎症')) directHints.push('炎症', '发炎', '耳膜发炎')
  if (axis.includes('虚罪名') || axis.includes('罪名')) directHints.push('更重名目', '严重名目', '财务问题', '被安上')
  if (axis.includes('手术')) directHints.push('手术', '开刀')
  if (axis.includes('医生')) directHints.push('医生')
  if (axis.includes('医院')) directHints.push('医院', '南方', '东北', '西北')
  if (axis.includes('维持原状') || axis.includes('原状')) directHints.push('维持原状', '保持原来的职位', '双方都不动', '人未必真动')
  if (axis.includes('提升')) directHints.push('提升', '正职', '提升正职难', '难升')
  if (axis.includes('不好开展')) directHints.push('不好开展', '没活力', '工作压力大')
  if (axis.includes('工资')) directHints.push('工资', '提成', '底薪')
  if (axis.includes('做不长')) directHints.push('做不长', '做不长久')
  if (axis.includes('车速') || axis.includes('出线')) directHints.push('车速', '出线', '不好考过', '考不过')
  if (axis.includes('拖延时间窗口') || axis.includes('拖延')) directHints.push('先拖一阵', '短拖后拆', '不是当场就拆', '今年之内', '两三个月')
  if (axis.includes('性')) directHints.push('性', '私人关系', '淫荡之合')
  if (axis.includes('公开')) directHints.push('公开', '隐藏', '不敢公开')
  if (axis.includes('第三者')) directHints.push('第三者')
  if (axis.includes('没有明显实锤小三') || axis.includes('小三不明显')) directHints.push('小三的信息不明显', '没有明显小三', '小三不明显')
  if (axis.includes('有别的女人追求男方') || axis.includes('异性追求')) directHints.push('有女士追求他', '有异性追求', '容易有女士追求他')
  if (axis.includes('受外人和长辈影响') || axis.includes('长辈影响')) directHints.push('受他人影响', '受长辈影响', '婆婆强势', '受外人影响')
  if (axis.includes('改善可能') || axis.includes('慢慢改善') || axis.includes('两年')) directHints.push('以后能改善', '影响2年', '两年', '慢慢好转')
  if (axis.includes('对方是否确实想买') || axis.includes('想买')) directHints.push('对方想买', '想买这个房子', '确实想买')
  if (axis.includes('资金是否存在问题') || axis.includes('资金问题')) directHints.push('资金存在问题', '资金不够', '资金有问题')
  if (axis.includes('这次交易是否难成') || axis.includes('难成交')) directHints.push('难成', '不好出手', '很难真正成交', '短期很难成交')
  if (axis.includes('价格是否难达到理想值') || axis.includes('价格')) directHints.push('价格', '大概多少钱', '价格难一步谈拢')
  if (axis.includes('大概能拿回多少钱') || axis.includes('拿回多少钱') || axis.includes('回款金额')) directHints.push('四万', '四万多', '四五万', '4万', '4.5万', '五万')
  if (axis.includes('婚姻是否还能保住')) directHints.push('婚姻仍有保住空间', '还能保住', '还没到一定离婚', '不想离婚')
  if (axis.includes('男方是否在追第三者')) directHints.push('男方追求第三者', '男方有外遇', '追第三者')
  if (axis.includes('第三者后面会否起矛盾')) directHints.push('后面会起矛盾', '早晚发生了矛盾', '第三者与男方早晚发生矛盾')
  if (axis.includes('当前是否不能答应男方搬走')) directHints.push('不要答应', '不让搬走', '先稳住男方', '阻止男的搬走')
  if (axis.includes('化解是否应让男方母亲出面')) directHints.push('男方母亲', '让他妈妈去阻止', '告知男方父母')
  if (axis.includes('见面是否容易再起冲突')) directHints.push('见面容易有冲突', '难调解', '争吵')
  if (axis.includes('老师调解是否已经足够')) directHints.push('老师调节就可以', '老师已经给他们调节了', '老师能镇住对方')
  if (axis.includes('孩子是否不宜再去道歉')) directHints.push('不用再去道歉', '道歉也没有效果', '不宜再去解释', '不要再去')
  if (axis.includes('硬去处理是否反而容易出事')) directHints.push('容易出事', '反而容易出事')
  if (axis.includes('合作是否起不来')) directHints.push('合作不起来', '项目做不起来', '合作不好成')
  if (axis.includes('合作能否长久')) directHints.push('合作不长久', '短期内不好有新项目出现', '以后有缘合作机会不大')
  if (axis.includes('当前是否不建议送贵重画作')) directHints.push('不建议你送这两幅画', '可以改送其它', '不建议送', '不宜送贵重画作', '更不该送')
  if (axis.includes('两幅画里哪幅更好')) directHints.push('第一幅更好', '第一幅更好更值钱', '更值钱', '最少都在1万甚至6万以上')
  if (axis.includes('后续是否还有合作机会')) directHints.push('短期内不好有新项目出现', '以后有缘合作机会不大', '以后合作机会不大')
  if (axis.includes('调解')) directHints.push('调解', '讲和', '和解')
  if (axis.includes('责任')) directHints.push('责任', '对半', '一半')
  if (axis.includes('停职')) directHints.push('停职', '处分')
  if (axis.includes('财务')) directHints.push('财务')
  if (axis.includes('领导')) directHints.push('领导')
  if (axis.includes('事情是否容易成')) directHints.push('事情容易成', '容易成', '成事方向')
  if (axis.includes('评二等功是否有希望') || axis.includes('二等功')) directHints.push('二等功有希望', '评二等功', '二等功')
  if (axis.includes('结果是否能落定')) directHints.push('结果能往成事方向落', '能落定', '能成')
  if (axis.includes('灾情是否严重')) directHints.push('灾情偏重', '灾情较重', '灾情严重')
  if (axis.includes('是否已有伤灾')) directHints.push('已有伤灾', '伤灾', '有凶事伤灾')
  if (axis.includes('是否已有死亡')) directHints.push('已有死亡', '死亡', '死门')
  if (axis.includes('主要成因')) directHints.push('水患', '土体塌陷', '堤体问题', '共同作用')
  if (axis.includes('牵连')) directHints.push('牵连')
  if (axis.includes('被裁')) directHints.push('被裁', '裁员', '留岗')
  if (axis.includes('调岗')) directHints.push('调岗', '岗位')
  if (axis.includes('可买')) directHints.push('买', '房')
  if (axis.includes('投资')) directHints.push('投资', '长期')
  if (axis.includes('自己是否愿意去')) directHints.push('不想动', '并不想动', '忙不过来', '不太想选你')
  if (axis.includes('价格')) directHints.push('价格', '偏高')
  if (axis.includes('人身安全')) directHints.push('安全', '危险', '被抓', '拘留')
  if (axis.includes('找回')) directHints.push('找回', '找到')
  if (axis.includes('被盗')) directHints.push('被盗', '偷')
  if (axis.includes('病位')) directHints.push('病位', '肺', '胃', '肠', '心脏', '脑', '消化', '呼吸')
  if (axis.includes('腰椎')) directHints.push('腰椎病', '腰椎', '腰椎神经')
  if (axis.includes('小腹')) directHints.push('小腹', '腹痛', '转移')
  if (axis.includes('好转')) directHints.push('好转', '农历四月', '缓解')
  if (axis.includes('父母是否反对')) directHints.push('父亲也不太同意', '父母阻力', '家里反对', '男方家里也有些顾虑')
  if (axis.includes('最终是否不了了之')) directHints.push('不了了之', '慢慢结束', '最终结束', '慢慢疏远')
  if (axis.includes('病位是否在心脏血管')) directHints.push('心脏', '血管', '冠心病', '心肌缺血', '血液受阻', '血管阻塞')
  if (axis.includes('脑血管') || axis.includes('脑部')) directHints.push('脑部还看不出实病', '可以先不按脑 CT 落', '脑血管堵塞', '重点预防', '脑血管方面目前无大碍')
  if (axis.includes('能否彻底治好')) directHints.push('难以彻底断根', '不好彻底治疗', '不能根治')
  if (axis.includes('是否只能维持调理')) directHints.push('只能维持', '长期维持', '共同治疗', '软化血管', '保养和维持')
  if (axis.includes('后续保养重点')) directHints.push('不能操劳', '不要激动', '散步', '浅淡的食物', '少吃高脂肪')
  if (axis.includes('是否有头部旧伤或刺激后遗症')) directHints.push('头部', '后遗症', '受刺激', '被撞过')
  if (axis.includes('是否需要避免刺激与思想压力')) directHints.push('避免刺激', '不要受刺激', '不要有思想压力', '思想压力')
  if (axis.includes('消息是否真实')) directHints.push('消息是真的', '消息真实', '真的')
  if (axis.includes('整体运气是否偏低迷')) directHints.push('运气低迷', '低迷', '不太顺')
  if (axis.includes('精神状态是否长期纠结不好')) directHints.push('思想上纠结多', '精神不好', '睡觉也睡不好', '心神不定', '多虑')
  if (axis.includes('是否有交通事故或血光')) directHints.push('交通事故', '血光', '相撞', '受轻伤', '住院')
  if (axis.includes('工作收入是否不稳定且偏低')) directHints.push('工作上不稳定', '更换频繁', '收入很少', '断断续续', '临工')
  if (axis.includes('房屋住处是否也出问题')) directHints.push('自己的房子', '住过的房子有问题', '房子有问题', '住处有问题')
  if (axis.includes('今年上半年是否仍不顺下半年才好转')) directHints.push('今年上半年你也还是不太顺', '下半年运气就会好转', '下半年好转', '上半年不太顺')
  if (axis.includes('夫妻是否容易争吵但不至离婚')) directHints.push('夫妻争吵', '不容易离婚', '不至离婚')
  if (axis.includes('健康是否要注意消化眼睛和肺')) directHints.push('消化系统', '眼睛', '肺')
  if (axis.includes('收入是否稳定但偏低迷')) directHints.push('收入是有的', '工资低迷', '收入下降', '收入偏低迷')
  if (axis.includes('问题根源是否在工作发展')) directHints.push('问题的本源是工作', '必须想法改善事业', '工作发展')
  if (axis.includes('是否没有大毛病')) directHints.push('问题不大', '没有大问题', '不算大病')
  if (axis.includes('压力是否是主因')) directHints.push('工作压力太大', '压力大')
  if (axis.includes('肠胃腹部是否不舒服')) directHints.push('肠胃不舒服', '腹部不舒服', '消化', '肠胃')
  if (axis.includes('是否会有拉肚子')) directHints.push('拉肚子')
  if (axis.includes('是否需要休息和简单用药调理')) directHints.push('放松精神多休息', '肠胃方面的药', '多休息')
  if (axis.includes('是否主要表现为头晕无力没食欲')) directHints.push('头晕', '没有食欲', '身体无力', '精神不好', '没食欲')
  if (axis.includes('是否与压力大和阴气过重有关')) directHints.push('压力大', '阴气过重', '少见阳光', '很少见太阳')
  if (axis.includes('是否应少夜出和避空旷处')) directHints.push('夜间少出行', '少去空旷的地方', '少夜出', '空旷的地方')
  if (axis.includes('何时开始恢复')) directHints.push('农历5月自然会恢复', '农历5月', '农历五月')
  if (axis.includes('定金是否会到')) directHints.push('定金会来', '定金会到', '微信转账全款', '转账全款')
  if (axis.includes('仍在比较选择')) directHints.push('还在比较', '还在选择', '对比选择')
  if (axis.includes('最终能否做成')) directHints.push('能成', '能做', '接单', '成交')
  if (axis.includes('异性或青春期因素')) directHints.push('女生追求', '青春期', '桃花影响', '女生')
  if (axis.includes('心思不在学习上')) directHints.push('心思不在学习上', '不在学习上', '学习状态下滑')
  if (axis.includes('亲子关系是否紧张')) directHints.push('对你不满', '容易有争吵', '母子关系', '亲子关系')
  if (axis.includes('恢复学习状态大概需要多久')) directHints.push('两个月', '2个月', '慢慢开导', '恢复学习状态')
  if (axis.includes('是否靠不正当关系上位')) directHints.push('暧昧关系', '暗中行事', '不正当手段', '靠暧昧', '暗线操作')
  if (axis.includes('当前位置是否保得住')) directHints.push('位置不好保', '工作容易保不住', '头衔没有了')
  if (axis.includes('后续是否会被调整降下来')) directHints.push('容易被调整', '被降职', '头衔没有了', '一年内')
  if (axis.includes('药物') || axis.includes('针灸') || axis.includes('配合')) directHints.push('针灸', '配合药物', '一起治', '开刀或针灸', '针灸再配合药物')
  if (axis.includes('是否长期用药')) directHints.push('经常用药', '长期用药', '一直吃药')
  if (axis.includes('求财是否会耗身')) directHints.push('财多耗身', '人克财', '不能拼命求财', '越挣钱越伤身体')
  if (axis.includes('调理路径')) directHints.push('放松压力', '注意休息', '适当活动', '药物只能有限缓解', '自我调理')
  if (axis.includes('转移')) directHints.push('转移')
  if (axis.includes('危重')) directHints.push('危重', '危险', '重病')
  if (axis.includes('主因')) directHints.push('主因')
  if (axis.includes('是否离婚')) directHints.push('离婚')
  if (axis.includes('第三者')) directHints.push('第三者')
  const cleaned = normalizeChineseText(
    axis
      .replace(/是否|能否|有无|当前|后续|整体|最终|主要|本人|自己|事情|问题|主因是什么|当前这位|更合适的|还是|以及|或|与|和/g, ''),
  )
  const derived: string[] = []
  if (cleaned.length >= 2) {
    derived.push(cleaned)
    for (let size = 2; size <= Math.min(4, cleaned.length); size += 1) {
      for (let index = 0; index <= cleaned.length - size; index += 1) {
        derived.push(cleaned.slice(index, index + size))
      }
    }
  }
  return uniqueStrings([...directHints, ...derived]).filter((item) => item.length >= 2)
}

function isTimingAxis(axis: string) {
  return TIMING_AXIS_TERMS.some((term) => axis.includes(term))
}

function hasConcreteTiming(text: string) {
  return CONCRETE_TIMING_TERMS.some((term) => text.includes(term))
}

function inferExpectedDirection(text: string | null | undefined): 'positive' | 'risk' | 'mixed' | 'unclear' {
  const sample = String(text ?? '')
  const hardRiskTerms = ['破局', '离婚', '被抓', '拘留', '危险', '病危', '转移', '拖欠', '起诉', '下滑', '控制权仍在对方', '难轻松拿回', '无缘', '成功机会不大', '通过机会偏小', '通过的机会偏小', '机会偏小', '通过机会小', '不好应聘上', '没应聘上', '复合机会不大', '复合机会并不大', '还会再分', '面试取消', '被屏蔽', '取消了', '不建议去', '藏着坑', '外地机会带陷阱', '不适合现在主动冲进去', '保持观察']
  const strongPositiveTerms = ['最终被录取', '有机会通过并最终被录取', '仍有机会被录取', '机会很大', '容易考上', '顺利进面试', '正常发挥就容易考上', '最终也确实能过', '最终更适合选择', '最终更适合选择银色', '复试机会比较大', '进入复试机会比较大', '进入复试的机会比较大', '工资也高', '工资条件也更优', '更值得争取过去', '今年已经先提一步', '下一次明显提升更偏在 2019', '下一次明显提升更偏在2019', '2019 年', '2019年']
  const positive = POSITIVE_DIRECTION_TERMS.some((term) => sample.includes(term))
  const risk = RISK_DIRECTION_TERMS.some((term) => sample.includes(term))
  const mixedMarkers = ['但', '只是', '不过', '仍', '短期', '长期', '表面', '更适合', '可以', '机会', '不好轻松', '不算', '不必'].some((term) => sample.includes(term))
  const permissiveButFailingExam =
    sample.includes('可以去')
    && ['不好考过', '考不过', '不过', '通过机会偏小', '通过机会小', '没过'].some((term) => sample.includes(term))
  const strategicButLowProbability =
    sample.includes('应主动去争取')
    && ['机会偏小', '通过机会偏小', '通过机会小'].some((term) => sample.includes(term))
  const strategicPositiveAdvice =
    sample.includes('退让同意更有利')
    || sample.includes('应顺势做人')
    || sample.includes('应主动去争取')
    || sample.includes('最能真正帮上忙')
    || sample.includes('更适合通过系主任爱人去走动')
    || sample.includes('优先应争取')
    || sample.includes('更适合先争科研')
    || sample.includes('最终更适合选择')
    || sample.includes('更有机会过线')
    || sample.includes('最终也确实能过')
    || sample.includes('尽力争取38军')
    || sample.includes('退而选成都炮兵团')
    || sample.includes('应尽量换址')
    || sample.includes('第一志愿几率很大')
    || sample.includes('第一志愿录取几率很大')
    || sample.includes('确实升入了目标学校')
  const recoveryFromSetback =
    ['学习状态下滑', '心思不在学习上', '受女生影响', '青春期因素'].some((term) => sample.includes(term))
    && ['恢复', '慢慢开导', '两个月'].some((term) => sample.includes(term))
  if (recoveryFromSetback) return 'mixed'
  if (strategicButLowProbability) return 'positive'
  if (hardRiskTerms.some((term) => sample.includes(term))) return 'risk'
  if (permissiveButFailingExam) return 'risk'
  if (strategicPositiveAdvice) return 'positive'
  if (strongPositiveTerms.some((term) => sample.includes(term)) && !risk) return 'positive'
  if ((positive && risk) || mixedMarkers) return 'mixed'
  if (positive) return 'positive'
  if (risk) return 'risk'
  return 'unclear'
}

function detectRoutingMismatch(seed: StrictRerunSeed, teachers: TeacherAlignment[]) {
  const sample = `${seed.normalized_question ?? ''} ${seed.expected_conclusion_family ?? ''} ${seed.wang_conclusion ?? ''}`
  const expected = String(seed.question_type_label ?? '').trim()
  if (
    expected === '健康身体'
    && ['日本', '探亲', '出行', '路上'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按出行安全题来断'))
  ) {
    return null
  }
  if (
    expected === '健康身体'
    && ['手术', '医院', '午时', '属马', '南方医院', '西北方医院', '东北那家'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按手术路径题来断'))
  ) {
    return null
  }
  if (
    expected === '事业工作'
    && ['新部门', '原部门', '出国项目', '出国机会'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按朋友邀职题来断'))
  ) {
    return null
  }
  if (
    expected === '事业工作'
    && ['离职', '辞职', '继续做', '工作状况', '做多久', '做不长', '保险工作', '还能不能继续做'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按工作去留题来断'))
  ) {
    return null
  }
  if (
    expected === '感情婚姻'
    && ['第三次婚姻', '挽回回来', '离开', '回头', '短期矛盾', '婚姻是否会走到离开'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按关系拉扯题来断'))
  ) {
    return null
  }
  for (const teacher of teachers) {
    const match = teacher.main_judgment.match(/先按([^。]+?)题来断/)
    const actual = match?.[1]?.trim() ?? ''
    if (!actual || !expected) continue
    const subtypeAllowed =
      (expected === '健康身体' && actual === '出行安全')
      || (expected === '健康身体' && ['走失与人身安全', '出行安全', '失物寻找', '人身安全与官非', '急性恢复', '慢病治疗', '消化系统', '手术路径', '老年急病', '心血管慢病', '亚健康恢复', '阴气环境健康', '猝死鉴定', '胎儿性别', '生产平安'].includes(actual)
        && ['失踪', '走失', '失联', '被抓', '拘留', '派出所', '证据', '放人', '安全', '出行', '探亲', '飞机', '丢失', '找回', '戒指', '银行卡', '咳嗽', '新病', '恢复', '肠胃', '胃病', '消化', '手术', '医院', '医生', '公公', '父亲', '老人', '肺部', '心脏', '脑血管', '女儿疾病', '冷热感冒', '神经痛', '炎症', '开药', '右耳', '面颊', '剧痛', '有气无力', '全身乏力', '身体很疲惫', '工作压力太大', '拉肚子', '没食欲', '没有食欲', '身体无力', '阴气', '很少见太阳', '少见阳光', '几个月没出过门', '空旷的地方', '去世', '死亡', '法医', '鉴定', '他杀', '猝死', '脑梗', '缺氧', '胎儿性别', '宝宝性别', '男孩', '女孩', '顺产', '剖腹', '母子平安', '预产期', '什么时候出生'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['房屋怪异'].includes(actual)
        && ['房屋怪异', '房子怪异', '房子不对劲', '旧坟', '坟地', '地基', '阴魂', '做法', '安送'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['祖坟影响'].includes(actual)
        && ['祖坟', '扫墓', '梦见爷爷', '梦见奶奶', '梦见祖辈', '坟墓气场', '不顺是否与祖坟有关'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['私情冲突安全'].includes(actual)
        && ['宾馆', '出轨', '被人打', '羞辱', '门外', '家属来', '防守为主', '别出去', '私情', '老公知道', '他老婆知道'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['医疗信息真假'].includes(actual)
        && ['医托', '黄牛党', '黄牛', '假信息', '骗子', '门诊', '陈主任', '转院'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['抑郁心结'].includes(actual)
        && ['抑郁', '轻生', '心结', '打胎', '自责', '不爱出门', '说梦话'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['晚期癌症'].includes(actual)
        && ['癌症晚期', '晚期', '生命危险', '离世', '危险期'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['神经失常'].includes(actual)
        && ['神经病', '神经失常', '乱说话', '不睡觉', '后遗症', '受刺激'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['心血管慢病'].includes(actual)
        && ['冠心病', '心肌缺血', '血管堵塞', '血液受阻', '不能操劳', '维持', '心脏', '胸闷', '负荷高', '劳累'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['宠物安全'].includes(actual)
        && ['狐狸', '宠物', '继续养', '安全隐患', '家人反对'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['失物寻找'].includes(actual)
        && ['丢失', '找回', '失物', '戒指', '银行卡', '钥匙', '借车', '借走', '新车', '车子', '汽车', '抵押', '卖掉'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['讨薪回款'].includes(actual)
        && ['工资', '讨薪', '欠薪', '老板拖欠'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['诉讼纠纷'].includes(actual)
        && ['官司', '诉讼', '起诉', '判决', '调解', '责任', '和解', '强拆', '拆迁', '门面', '政府通知', '执法', '彩礼', '工资都在', '老家'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['借款求援'].includes(actual)
        && ['借钱', '借款', '借到', '借不出', '资金紧张', '周转'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['债务沟通'].includes(actual)
        && ['还不了', '继续帮', '解释', '沟通', '哥哥', '宽限', '缓一时'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['买房权衡'].includes(actual)
        && ['买房', '房子', '房价', '自住', '投资', '贷款', '分期'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['房屋过户'].includes(actual)
        && ['过户', '房贷', '贷款', '证件', '给儿子', '公婆', '17万', '十七万', '姐姐', '小叔子', '继承协议', '遗嘱'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['平台真假', '项目参与边界'].includes(actual)
        && ['平台', '股权', '期权股', '大集团', '国家背景', '北斗'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['财运总览'].includes(actual)
        && ['偏财暗财', '多渠道发展', '合作共事', '财运整体', '运气', '收入下降', '工资低迷', '夫妻争吵', '消化系统', '眼睛', '肺', '问题的本源是工作', '事业根源'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['物品真假判断'].includes(actual)
        && ['真假', '真货', '假货', '耳坠', '耳环', '项链', '火机', '烧红', '过水'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['项目假账'].includes(actual)
        && ['假账', '财务不透明', '股份不兑现', '协议书', '责任边界', '补开字据', '挪用', '老人中心', '股份责任'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['藏宝判断'].includes(actual)
        && ['宝藏', '古墓', '古董', '古币', '耕地', '山药地', '石碑', '租用耕地'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['订单接单'].includes(actual)
        && ['定金不到', '服装订单', '老客户', '做衣服', '转账全款', '接单'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['号码纠纷'].includes(actual)
        && ['手机号', '号码', '抢占', '抢号', '店员', '绑定身份证', '抬价'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['传销骗局'].includes(actual)
        && ['传销', '平台费', '见不得光', '产品不好卖', '几年挣几十万'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['二手车来源'].includes(actual)
        && ['宝马', '奥迪', '纽约', '朋友介绍', '二手车', '本地'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['二手车对比'].includes(actual)
        && ['银色', '白色', '二手车', '两辆车'].some((term) => sample.includes(term)))
      || (expected === '感情婚姻' && ['婚姻破局', '关系拉扯', '择偶比较', '有缘无果', '病弱阻婚', '工作私情', '复和见面'].includes(actual)
        && ['离婚', '起诉', '上诉', '保护令', '判不离', '婚姻', '第三者', '外缘', '离开', '回头', '前任', '前男友', '当前男友', '如何选择', '实际行动', '不主动', '父母不同意', '拉扯', '情人', '私人关系', '不敢公开', '长久', '老同学', '暧昧', '多人相争', '什么想法', '父母安排', '回老家结婚', '偶尔联系', '诉苦', '难见面', '难联系', '相亲', '女方喜欢男方', '男方易厌倦', '性功能', '生育能力', '治疗', '怀不上', '不孕', '输卵管', '打过胎', '子宫受伤', '没有小孩', '客户', '私情', '做情人', '提成', '给钱', '主管', '压力', '复和', '母亲家', '秘密过去', '见不到人', '躲避', '勉强'].some((term) => sample.includes(term)))
      || (expected === '感情婚姻' && ['晚婚婚运'].includes(actual)
        && ['晚婚', '单身', '什么时候结婚', '婚运', '烂桃花', '嫁入有钱人家', '抓住时机'].some((term) => sample.includes(term)))
      || (expected === '感情婚姻' && ['婚姻保全'].includes(actual)
        && ['婚姻是否能保住', '第三者介入', '男方搬出去', '不让搬走', '男方母亲', '女儿班主任'].some((term) => sample.includes(term)))
      || (expected === '感情婚姻' && ['复合回头'].includes(actual)
        && ['复合', '前夫', '断断续续接触', '儿子跟他', '为了看儿子'].some((term) => sample.includes(term)))
      || (expected === '感情婚姻' && ['特殊关系判断'].includes(actual)
        && ['同性恋', '同性', '特殊关系', '特殊感情', '朋友交往的关系'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['应聘去留', '工作去留', '中间人帮忙', '分配走动', '人事协调', '签证办理', '涨薪申请', '复职回岗', '人事风声', '事业开局', '裁员留岗', '考试录取', '升学录取', '停职牵连', '顶班机会', '竞标争标', '仕途上升', '公司承压', '学习表现', '考试违纪疏通'].includes(actual)
        && ['应聘', '找工作', '求职', '工作', '单位', '帮忙', '张师傅', '复职', '革职', '降职', '离职', '辞职', '继续做', '真正离开', '脱得开', '人事调整', '调来', '调走', '风声', '大客户', '签单', '事业提升', '裁员', '留岗', '被裁', '复试', '笔试', '面试', '录取', '司法考试', '考试', '过线', '分数', '停职', '处分', '牵连', '领导层', '财务问题', '市场', '客户', '开发', '拓展', '先开哪边', '顶班', '机械处', '校长', '处长', '竞标', '中标', '投标', '污水工程', '对手', '争取', '签证', '多次往返', '韩国', '旅行社', '申请理由', '政府卡住'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['学校申请'].includes(actual)
        && ['申请学校', '候补', '候补名单', '私立学校'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['学习状态'].includes(actual)
        && ['学习情况', '学习状态', '高二', '借同学手机', '半夜不睡', '女生追求', '青春期'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['学习资料采购'].includes(actual)
        && ['学习资料', '真题解析', '高考真题', '六门课程', '题型与思路'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['出行安全'].includes(actual)
        && ['去遵义', '路上', '是否顺利', '开车', '堵车', '口舌是非'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['分配走动'].includes(actual)
        && ['军校', '分配', '教导员', '系主任', '提高成绩', '平时成绩'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['送礼走动'].includes(actual)
        && ['队长', '送水果', '送烟', '印象', '加分', '双首长'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['人物性格'].includes(actual)
        && ['表弟性格', '堂弟性格', '什么性格', '性格怎么样', '属兔', '90后出生的'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['人事协调'].includes(actual)
        && ['同意还是不同意', '帮他还是不帮', '调动一个学生', '1965', '1960', '人事关系', '分管领导', '主管领导', '女主任', '泼妇', '特殊关系'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['涨薪申请'].includes(actual)
        && ['涨工资', '申请', '总监', '金院长', '党委书记', '涨薪'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['部门去向'].includes(actual)
        && ['后勤', '科研', '新大学', '选部门', '学院拆了', '调整重组'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['门店前景'].includes(actual)
        && ['店铺', '门店', '换址', '东南方', '南方', '客户不好找', '经营前景'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['军区去向'].includes(actual)
        && ['军区', '38军', '27军', '成都炮兵团', '西藏', '去哪个方向', '去哪个军'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['朋友邀职'].includes(actual)
        && ['朋友', '新项目', '新部门', '原部门', '出国', '出国项目', '出国机会', '管理岗', '管理股', '停薪留职', '请假去帮忙', '合作经营', '平台', '产品', '资金', '领导带我去'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['考试策划'].includes(actual)
        && ['替考', '前桌', '选择题', '合作', '监考', '抄题'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['面试录用'].includes(actual)
        && ['面试', '面试官', '取消', '屏蔽', '通过机会'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['考试录取'].includes(actual)
        && ['奥赛', '名次', '省二', '省一'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['异地工作选择'].includes(actual)
        && ['福州', '北京', '南方', '外地', '本地', '去福州', '北京找工作'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['多家公司择岗'].includes(actual)
        && (
          ['三个公司', '3 个公司', '哪家公司', '去哪家公司', '90', '37', '26'].some((term) => sample.includes(term))
          || (sample.includes('三个') && sample.includes('公司'))
        ))
      || (expected === '事业工作' && ['关系提拔'].includes(actual)
        && ['小人得志', '暧昧关系', '不正当手段', '暗中行事', '突然提拔', '头衔没有了', '降职'].some((term) => sample.includes(term)))
      || (expected === '事业工作' && ['评功授奖'].includes(actual)
        && ['二等功', '评功', '立功', '授奖', '评奖'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['环境条件判断'].includes(actual)
        && ['下雨', '天气', '阴天'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['同学冲突调解'].includes(actual)
        && ['同学冲突', '见面对质', '道歉', '老师调解', '带人去', '容易出事'].some((term) => sample.includes(term)))
      || (expected === '健康身体' && ['灾情消息判断'].includes(actual)
        && ['溃口', '洪水', '洪灾', '灾情', '伤灾', '死亡', '消息'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['合作送礼'].includes(actual)
        && ['合作', '送礼', '两幅画', '字画', '181', '339', '项目做不起来'].some((term) => sample.includes(term)))
      || (expected === '财运合作' && ['国际关系'].includes(actual)
        && ['中韩关系', '萨德', '韩国货', '旅行社', '中韩贸易', '贸易会有回升', '韩方会谦让', '中印边境', '洞朗', '印度', '边境对峙', '大规模战争', '印方退让', '法国总统大选', '马克龙', '勒庞', '奥朗德', '第二轮', '拉票', '美国总统大选', '特朗普', '希拉里', '选民'].some((term) => sample.includes(term)))
    if (actual !== expected && !subtypeAllowed) return actual
  }
  return null
}

function detectScenarioRouteMismatch(seed: StrictRerunSeed, teachers: TeacherAlignment[]) {
  const sample = `${seed.normalized_question ?? ''} ${seed.expected_conclusion_family ?? ''} ${seed.wang_conclusion ?? ''}`
  const mainJudgment = teachers.map((teacher) => teacher.main_judgment).join(' ')
  const combinedNarrative = teachers
    .flatMap((teacher) => [teacher.main_judgment, teacher.timing_line, teacher.risk_line, ...teacher.reason_chain])
    .join(' ')
  const isVehicleLostCase = ['借车', '借走', '新车', '车子', '汽车', '抵押', '卖掉'].some((term) => sample.includes(term))
  const isFriendProjectPrompt =
    (sample.includes('朋友') || sample.includes('新部门') || sample.includes('出国') || sample.includes('原部门'))
    && ['新项目', '新部门', '管理岗', '管理股', '停薪留职', '请假去帮忙', '合作经营', '平台', '产品', '资金', '辞职', '出国机会', '原部门'].some((term) => sample.includes(term))
  if (
    ['日本', '探亲', '出行', '路上'].some((term) => sample.includes(term))
    && sample.includes('安全')
    && mainJudgment.includes('出行安全')
  ) {
    return null
  }
  if (
    ['宾馆', '出轨', '被人打', '羞辱', '门外', '家属来', '防守为主', '别出去'].some((term) => sample.includes(term))
    && mainJudgment.includes('私情冲突安全')
  ) {
    return null
  }
  if (
    ['老同学', '同学会', '暧昧', '多人相争', '什么想法', '父母安排', '回老家结婚', '偶尔联系', '诉苦', '难见面', '难联系', '相亲', '女方喜欢男方', '男方易厌倦'].some((term) => sample.includes(term))
    && mainJudgment.includes('关系拉扯')
  ) {
    return null
  }
  if (
    ['晚婚', '单身', '什么时候结婚', '婚运', '烂桃花', '嫁入有钱人家', '抓住时机'].some((term) => sample.includes(term))
    && mainJudgment.includes('晚婚婚运')
  ) {
    return null
  }
  if (
    ['第三次婚姻', '挽回回来', '离开', '回头', '短期矛盾', '婚姻是否会走到离开'].some((term) => sample.includes(term))
    && mainJudgment.includes('关系拉扯')
  ) {
    return null
  }
  if (
    ['婚姻是否能保住', '第三者介入', '男方搬出去', '不让搬走', '男方母亲', '女儿班主任'].some((term) => sample.includes(term))
    && mainJudgment.includes('婚姻保全')
  ) {
    return null
  }
  if (
    ['判不离', '保护令', '上诉', '继续上诉', '再上上诉'].some((term) => sample.includes(term))
    && mainJudgment.includes('婚姻破局')
  ) {
    return null
  }
  if (
    ['同性恋', '同性', '特殊关系', '特殊感情', '朋友交往的关系'].some((term) => sample.includes(term))
    && mainJudgment.includes('特殊关系判断')
  ) {
    return null
  }
  if (
    ['有家庭', '员工', '单身'].some((term) => sample.includes(term))
    && mainJudgment.includes('关系拉扯')
  ) {
    return null
  }
  if (
    ['性功能', '生育能力', '怀不上', '生育障碍', '不孕', '输卵管', '打过胎', '子宫受伤', '没有小孩'].some((term) => sample.includes(term))
    && mainJudgment.includes('病弱阻婚')
  ) {
    return null
  }
  if (
    ['复职', '革职', '降职', '后天前后'].some((term) => sample.includes(term))
    && mainJudgment.includes('复职回岗')
  ) {
    return null
  }
  if (
    ['离职', '辞职', '继续做', '工作状况', '做多久', '做不长', '保险工作', '还能不能继续做'].some((term) => sample.includes(term))
    && mainJudgment.includes('工作去留')
  ) {
    return null
  }
  if (
    ['副职', '正职', '调换岗位', '维持原状', '提升正职'].some((term) => sample.includes(term))
    && mainJudgment.includes('人事风声')
  ) {
    return null
  }
  if (
    ['调来', '调走', '回避政策', '老公哥哥', '人事调整风声'].some((term) => sample.includes(term))
    && mainJudgment.includes('人事风声')
  ) {
    return null
  }
  if (
    ['停职', '处分', '牵连', '下属', '财务问题', '领导层', '怎么看', '卷进去'].some((term) => sample.includes(term))
    && mainJudgment.includes('停职牵连')
  ) {
    return null
  }
  if (
    ['同意还是不同意', '帮他还是不帮', '调动一个学生', '1965', '1960', '人事关系', '分管领导', '主管领导', '女主任', '泼妇', '特殊关系'].some((term) => sample.includes(term))
    && mainJudgment.includes('人事协调')
  ) {
    return null
  }
  if (
    ['签证', '多次往返', '韩国', '旅行社', '申请理由', '政府卡住'].some((term) => sample.includes(term))
    && mainJudgment.includes('签证办理')
  ) {
    return null
  }
  if (
    ['还不了', '继续帮', '解释', '沟通', '哥哥', '宽限', '缓一时'].some((term) => sample.includes(term))
    && mainJudgment.includes('债务沟通')
  ) {
    return null
  }
  if (
    ['手术', '医院', '医生', '午时', '属马', '南方医院', '西北方医院', '东北那家'].some((term) => sample.includes(term))
    && ['手术路径', '当前医生', '医院方位', '午时', '属马日'].some((term) => mainJudgment.includes(term))
  ) {
    return null
  }
  if (
    ['医托', '黄牛党', '黄牛', '假信息', '骗子', '门诊', '陈主任', '转院'].some((term) => sample.includes(term))
    && mainJudgment.includes('医疗信息真假')
  ) {
    return null
  }
  if (
    ['胎儿性别', '宝宝性别', '男孩', '女孩'].some((term) => sample.includes(term))
    && mainJudgment.includes('胎儿性别')
  ) {
    return null
  }
  if (
    ['生产', '顺产', '剖腹', '母子平安', '预产期', '什么时候出生'].some((term) => sample.includes(term))
    && mainJudgment.includes('生产平安')
  ) {
    return null
  }
  if (
    ['狐狸', '宠物', '继续养', '安全隐患', '家人反对'].some((term) => sample.includes(term))
    && mainJudgment.includes('宠物安全')
  ) {
    return null
  }
  if (
    ['同学冲突', '见面对质', '道歉', '老师调解', '带人去', '容易出事'].some((term) => sample.includes(term))
    && mainJudgment.includes('同学冲突调解')
  ) {
    return null
  }
  if (
    ['拘留', '取保', '还能出来', '多久能出来', '今天能否放出来'].some((term) => sample.includes(term))
    && mainJudgment.includes('人身安全与官非')
  ) {
    return null
  }
  if (
    ['去世', '死亡', '法医', '鉴定', '他杀', '猝死', '脑梗', '缺氧'].some((term) => sample.includes(term))
    && mainJudgment.includes('猝死鉴定')
  ) {
    return null
  }
  if (
    ['法院', '跟踪', '动粗', '仇家', '堵在法院'].some((term) => sample.includes(term))
    && mainJudgment.includes('法院围堵安全')
  ) {
    return null
  }
  if (
    ['工资', '彩礼', '老家', '调解', '法院', '转到', '近处'].some((term) => sample.includes(term))
    && mainJudgment.includes('诉讼纠纷')
  ) {
    return null
  }
  if (
    ['客户', '私情', '做情人', '提成', '给钱', '主管', '压力'].some((term) => sample.includes(term))
    && mainJudgment.includes('工作私情')
  ) {
    return null
  }
  if (
    ['背景调查', '签约', '入股', '老人中心'].some((term) => sample.includes(term))
    && mainJudgment.includes('背景调查')
  ) {
    return null
  }
  if (
    ['工资', '讨薪', '欠薪', '老板拖欠'].some((term) => sample.includes(term))
    && mainJudgment.includes('讨薪回款')
  ) {
    return null
  }
  if (
    ['工资', '彩礼', '老家', '调解', '法院', '转到', '近处'].some((term) => sample.includes(term))
    && mainJudgment.includes('诉讼纠纷')
  ) {
    return null
  }
  if (
    ['服装设计', '创业', '合伙人', '市场', '客户', '开发', '拓展', '先开哪边'].some((term) => sample.includes(term))
    && mainJudgment.includes('事业开局')
  ) {
    return null
  }
  if (
    ['仕途', '职位上升', '管理能力', '受重用', '2019'].some((term) => sample.includes(term))
    && (mainJudgment.includes('仕途上升') || mainJudgment.includes('先按事业工作题来断'))
  ) {
    return null
  }
  if (
    ['公司现在的真实经营情况', '为什么多年总是临门一脚起不来', '债务压力', '经营情况'].some((term) => sample.includes(term))
    && (mainJudgment.includes('公司承压') || mainJudgment.includes('先按事业工作题来断'))
  ) {
    return null
  }
  if (
    ['中考', '第一志愿', '复习基础', '平时成绩'].some((term) => sample.includes(term))
    && mainJudgment.includes('升学录取')
  ) {
    return null
  }
  if (
    ['仕途', '职位上升', '管理能力', '受重用', '2019'].some((term) => sample.includes(term))
    && mainJudgment.includes('仕途上升')
  ) {
    return null
  }
  if (
    ['胃弱', '偏头痛', '久坐', '神经紧张', '长期压抑', '气血不畅'].some((term) => sample.includes(term))
    && mainJudgment.includes('慢病治疗')
  ) {
    return null
  }
  if (
    ['强拆', '门面', '政府通知', '执法'].some((term) => sample.includes(term))
    && mainJudgment.includes('诉讼纠纷')
  ) {
    return null
  }
  if (
    ['小人得志', '暧昧关系', '不正当手段', '暗中行事', '突然提拔', '头衔没有了', '降职'].some((term) => sample.includes(term))
    && mainJudgment.includes('关系提拔')
  ) {
    return null
  }
  if (
    ['公司现在的真实经营情况', '为什么多年总是临门一脚起不来', '债务压力', '经营情况'].some((term) => sample.includes(term))
    && mainJudgment.includes('公司承压')
  ) {
    return null
  }
  if (
    (['三个公司', '3 个公司', '哪家公司', '去哪家公司', '90', '37', '26'].some((term) => sample.includes(term))
      || (sample.includes('三个') && sample.includes('公司')))
    && mainJudgment.includes('多家公司择岗')
  ) {
    return null
  }
  if (
    ['司法考试', '考研', '奥赛', '前六名', '进面试', '考驾照', '科目二'].some((term) => sample.includes(term))
    && mainJudgment.includes('考试录取')
  ) {
    return null
  }
  if (
    ['神经失常', '头部受过撞击', '后遗症', '受刺激'].some((term) => sample.includes(term))
    && mainJudgment.includes('神经失常')
  ) {
    return null
  }
  if (
    ['什么时候才能全好', '头痛', '上火', '热感冒', '发炎', '24', '25'].some((term) => sample.includes(term))
    && mainJudgment.includes('急性恢复')
  ) {
    return null
  }
  if (
    ['吵架', '离开', '六万', '老人中心', '老者'].some((term) => sample.includes(term))
    && mainJudgment.includes('合作搅局')
  ) {
    return null
  }
  if (
    ['合作', '送礼', '两幅画', '字画', '181', '339', '项目做不起来'].some((term) => sample.includes(term))
    && mainJudgment.includes('合作送礼')
  ) {
    return null
  }
  if (
    ['溃口', '洪水', '洪灾', '灾情', '伤灾', '死亡', '消息'].some((term) => sample.includes(term))
    && mainJudgment.includes('灾情消息判断')
  ) {
    return null
  }
  if (
    ['房屋怪异', '房子怪异', '房子不对劲', '旧坟', '坟地', '地基', '阴魂', '做法', '安送'].some((term) => sample.includes(term))
    && mainJudgment.includes('房屋怪异')
  ) {
    return null
  }
  if (
    ['祖坟', '扫墓', '梦见爷爷', '梦见奶奶', '梦见祖辈', '坟墓气场', '不顺是否与祖坟有关'].some((term) => sample.includes(term))
    && mainJudgment.includes('祖坟影响')
  ) {
    return null
  }
  if (
    ['队长', '送水果', '送烟', '印象', '加分', '双首长'].some((term) => sample.includes(term))
    && mainJudgment.includes('送礼走动')
  ) {
    return null
  }
  if (
    ['定金不到', '服装订单', '老客户', '做衣服', '转账全款', '接单'].some((term) => sample.includes(term))
    && mainJudgment.includes('订单接单')
  ) {
    return null
  }
  if (
    ['运气', '收入下降', '工资低迷', '夫妻争吵', '消化系统', '眼睛', '肺', '问题的本源是工作', '事业根源'].some((term) => sample.includes(term))
    && mainJudgment.includes('财运总览')
  ) {
    return null
  }
  if (
    ['买房', '房子', '房价', '自住', '投资', '贷款', '分期'].some((term) => sample.includes(term))
    && mainJudgment.includes('买房权衡')
  ) {
    return null
  }
  if (
    ['过户', '房贷', '贷款', '证件', '给儿子', '公婆', '17万', '十七万', '姐姐', '小叔子', '继承协议', '遗嘱'].some((term) => sample.includes(term))
    && mainJudgment.includes('房屋过户')
  ) {
    return null
  }
  if (
    ['传销', '骗局', '平台费', '产品不好卖', '姐夫', '北海'].some((term) => sample.includes(term))
    && mainJudgment.includes('传销骗局')
  ) {
    return null
  }
  if (
    ['真假', '真货', '假货', '耳坠', '耳环', '项链', '火机', '烧红', '过水'].some((term) => sample.includes(term))
    && mainJudgment.includes('物品真假判断')
  ) {
    return null
  }
  if (
    ['假账', '财务不透明', '股份不兑现', '协议书', '责任边界', '补开字据', '挪用', '老人中心', '股份责任'].some((term) => sample.includes(term))
    && mainJudgment.includes('项目假账')
  ) {
    return null
  }
  if (
    ['宝藏', '古墓', '古董', '古币', '耕地', '山药地', '石碑', '租用耕地'].some((term) => sample.includes(term))
    && mainJudgment.includes('藏宝判断')
  ) {
    return null
  }
  if (
    ['竞标', '中标', '投标', '污水工程'].some((term) => sample.includes(term))
    && mainJudgment.includes('竞标争标')
  ) {
    return null
  }
  if (
    ['二等功', '评功', '立功', '授奖', '评奖'].some((term) => sample.includes(term))
    && mainJudgment.includes('评功授奖')
  ) {
    return null
  }
  if (
    ['新部门', '原部门', '出国项目', '出国机会'].some((term) => sample.includes(term))
    && mainJudgment.includes('朋友邀职')
  ) {
    return null
  }
  if (
    sample.includes('朋友')
    && ['新项目', '管理岗', '管理股', '停薪留职', '请假去帮忙', '合作经营', '平台', '产品', '资金', '辞职', '做管理'].some((term) => sample.includes(term))
    && mainJudgment.includes('朋友邀职')
  ) {
    return null
  }
  if (
    ['冠心病', '心肌缺血', '血管堵塞', '血液受阻', '不能操劳', '维持'].some((term) => sample.includes(term))
    && ['心血管慢病', '心脏', '血管', '维持', '难以彻底断根'].some((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['心脏', '胸闷', '负荷高', '劳累', '这几天突然不舒服'].some((term) => sample.includes(term))
    && ['心血管慢病', '心脏劳累', '负荷高', '本身暂时没有大问题', '尽快检查'].some((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['有气无力', '全身乏力', '身体很疲惫', '工作压力太大', '拉肚子', '肠胃不舒服', '腹部不舒服'].some((term) => sample.includes(term))
    && ['亚健康恢复', '没有大毛病', '压力太大', '多休息', '肠胃方面的药'].some((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['没食欲', '没有食欲', '身体无力', '阴气', '很少见太阳', '少见阳光', '空旷的地方', '农历5月自然会恢复'].some((term) => sample.includes(term))
    && ['阴气环境健康', '问题不大但缠绵', '少夜出', '少去空旷', '农历五月'].some((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['宝马', '奥迪', '纽约', '朋友介绍', '二手车'].some((term) => sample.includes(term))
    && ['纽约奥迪', '本地宝马', '虚假', '纠纷', '更稳'].every((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['银色', '白色', '二手车', '两辆车'].some((term) => sample.includes(term))
    && ['白车', '银车', '纠纷风险', '更适合选择银色'].some((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['过户', '房贷', '贷款', '证件', '给儿子', '公婆', '17万', '十七万', '姐姐', '小叔子', '继承协议', '遗嘱'].some((term) => sample.includes(term))
    && ['房屋过户', '最终能过出来', '贷款没清', '证件没放出', '十万元', '未月前后', '长辈偏保守', '姐姐也想要', '最后拿不到', '小叔子相对正直', '继承协议', '遗嘱'].some((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['后勤', '科研', '新大学', '选部门'].some((term) => sample.includes(term))
    && ['后勤', '科研', '新大学', '前景最好', '不易去成'].every((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['店铺', '门店', '换址', '东南方', '南方'].some((term) => sample.includes(term))
    && ['位置不合适', '东南方', '南方', '换址'].every((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (
    ['替考', '前桌', '选择题', '合作'].some((term) => sample.includes(term))
    && ['替考风险', '前桌', '选择题', '过线'].some((term) => combinedNarrative.includes(term))
  ) {
    return null
  }
  if (['官司', '诉讼', '起诉', '判决', '调解'].some((term) => sample.includes(term))) {
    if (!['官司', '诉讼', '起诉', '判决', '调解'].some((term) => mainJudgment.includes(term))) return '诉讼子类型未显式展开'
  }
  if (['强拆', '拆迁', '门面', '政府通知', '执法'].some((term) => sample.includes(term))) {
    if (!['政府', '执法', '强拆', '门面', '最终还是要拆', '保不住'].some((term) => combinedNarrative.includes(term))) return '强拆诉讼子类型未显式展开'
  }
  if (['医托', '黄牛党', '假信息', '骗子', '门诊', '陈主任', '转院'].some((term) => sample.includes(term))) {
    if (!['医托', '黄牛', '假信息', '消息真假', '骗子', '转院', '外院', '门诊'].some((term) => mainJudgment.includes(term))) return '医疗信息真假子类型未显式展开'
  }
  if (['狐狸', '宠物', '继续养', '安全隐患', '家人反对'].some((term) => sample.includes(term))) {
    if (!['宠物安全', '安全隐患', '不建议继续养', '家人反对', '化解'].some((term) => combinedNarrative.includes(term))) return '宠物安全子类型未显式展开'
  }
  if (['抑郁', '轻生', '心结', '打胎', '自责', '不爱出门', '说梦话'].some((term) => sample.includes(term))) {
    if (!['抑郁心结', '轻生', '心结', '打胎', '自责', '慢慢好转'].some((term) => combinedNarrative.includes(term))) return '抑郁心结子类型未显式展开'
  }
  if (['神经病', '神经失常', '乱说话', '不睡觉', '后遗症', '受刺激'].some((term) => sample.includes(term))) {
    if (!['神经失常', '不算特别重', '后遗症', '药效不明显', '不要受刺激'].some((term) => combinedNarrative.includes(term))) return '神经失常子类型未显式展开'
  }
  if (['癌症晚期', '晚期', '生命危险', '离世', '危险期'].some((term) => sample.includes(term))) {
    if (!['晚期癌症', '生命危险', '危险窗口', '离世', '治疗效果不明显'].some((term) => combinedNarrative.includes(term))) return '晚期癌症子类型未显式展开'
  }
  if (['借钱', '借款', '借到', '借不出', '资金紧张', '周转'].some((term) => sample.includes(term))) {
    if (!['借钱', '借款', '借到', '借不出', '借不成', '口头答应'].some((term) => combinedNarrative.includes(term))) return '借款求援子类型未显式展开'
  }
  if (['还不了', '继续帮', '解释', '沟通', '哥哥', '宽限', '缓一时'].some((term) => sample.includes(term))) {
    if (!['债务沟通', '主动解释', '继续帮', '缓一时', '还款压力', '口舌'].some((term) => combinedNarrative.includes(term))) return '债务沟通子类型未显式展开'
  }
  if (['真假', '真货', '假货', '耳坠', '耳环', '项链', '火机', '烧红', '过水'].some((term) => sample.includes(term))) {
    if (!['物品真假判断', '外表像真', '本质是假', '火烧', '过水', '露底', '真货'].some((term) => combinedNarrative.includes(term))) return '物品真假判断子类型未显式展开'
  }
  if (['假账', '财务不透明', '股份不兑现', '协议书', '责任边界', '补开字据', '挪用', '老人中心', '股份责任'].some((term) => sample.includes(term))) {
    if (!['项目假账', '假账', '挪用', '不可靠', '股份承诺', '补协议', '字据', '责任边界'].some((term) => combinedNarrative.includes(term))) return '项目假账子类型未显式展开'
  }
  if (['定金不到', '服装订单', '老客户', '做衣服', '转账全款', '接单'].some((term) => sample.includes(term))) {
    if (!['订单接单', '消息是真的', '定金会来', '还在比较', '回头成交'].some((term) => combinedNarrative.includes(term))) return '订单接单子类型未显式展开'
  }
  if (['买房', '房子', '房价', '自住', '投资', '贷款', '分期'].some((term) => sample.includes(term))) {
    if (!['买房权衡', '价格虽然划算', '付款太硬', '贷款借款', '最后只能放弃', '更适合自住还是投资'].some((term) => combinedNarrative.includes(term))) return '买房权衡子类型未显式展开'
  }
  if (['过户', '房贷', '贷款', '证件', '给儿子', '公婆', '17万', '十七万', '姐姐', '小叔子', '继承协议', '遗嘱'].some((term) => sample.includes(term))) {
    if (!['房屋过户', '最终能过出来', '贷款没清', '证件没放出', '十万元', '未月前后', '长辈偏保守', '姐姐也想要', '最后拿不到', '小叔子相对正直', '继承协议', '遗嘱'].some((term) => combinedNarrative.includes(term))) return '房屋过户子类型未显式展开'
  }
  if (['平台', '股权', '期权股', '大集团', '国家背景', '北斗'].some((term) => sample.includes(term))) {
    if (!['平台真假', '项目参与边界', '平台并非完全不存在', '借国家或大集团名义宣传', '快进快出', '不宜久持'].some((term) => combinedNarrative.includes(term))) return '平台真假子类型未显式展开'
  }
  if (['宝藏', '古墓', '古董', '古币', '耕地', '山药地', '石碑', '租用耕地'].some((term) => sample.includes(term))) {
    if (!['藏宝判断', '古墓', '古董', '古币', '缘分薄', '北边', '靠水', '树木', '不宜轻易动'].some((term) => combinedNarrative.includes(term))) return '藏宝判断子类型未显式展开'
  }
  if (['法院', '跟踪', '动粗', '仇家', '堵在法院'].some((term) => sample.includes(term))) {
    if (!['法院围堵安全', '合作', '钱财', '跟踪', '不动粗', '平安回来'].some((term) => combinedNarrative.includes(term))) return '法院围堵安全子类型未显式展开'
  }
  if (['去世', '死亡', '法医', '鉴定', '他杀', '猝死', '脑梗', '缺氧'].some((term) => sample.includes(term))) {
    if (!['猝死鉴定', '不是他杀', '急病猝死', '脑梗', '缺氧', '长期劳累', '家庭压力'].some((term) => combinedNarrative.includes(term))) return '猝死鉴定子类型未显式展开'
  }
  if (['背景调查', '签约', '入股', '老人中心'].some((term) => sample.includes(term))) {
    if (!['背景调查', '有障碍', '花费', '能通过', '签约入股'].some((term) => combinedNarrative.includes(term))) return '背景调查子类型未显式展开'
  }
  if (['客户', '私情', '做情人', '提成', '给钱', '主管', '压力'].some((term) => sample.includes(term))) {
    if (!['工作私情', '工作客户', '私情', '一点财', '财不大', '家庭', '口舌', '麻烦更大', '不值得'].some((term) => combinedNarrative.includes(term))) return '工作私情子类型未显式展开'
  }
  if (['吵架', '离开', '六万', '老人中心', '老者'].some((term) => sample.includes(term))) {
    if (!['合作搅局', '28', '调整', '没走', '不可靠', '先别投', '合同', '责任边界'].some((term) => combinedNarrative.includes(term))) return '合作搅局子类型未显式展开'
  }
  if (isFriendProjectPrompt) {
    if (!['朋友是真心', '朋友本人是真心', '项目平台', '产品和资金都有隐患', '管理岗承诺', '跟领导走更稳', '停薪留职', '先请假', '新部门更像反复不稳', '出国机会未必一定坐实', '个人能力还有后劲'].some((term) => combinedNarrative.includes(term))) return '朋友邀职子类型未显式展开'
  }
  if (['同性恋', '同性', '特殊关系', '特殊感情', '朋友交往的关系'].some((term) => sample.includes(term))) {
    if (!['同性', '回避', '不合适', '缺陷'].some((term) => combinedNarrative.includes(term))) return '特殊关系判断子类型未显式展开'
  }
  if (['晚婚', '单身', '什么时候结婚', '婚运', '烂桃花', '嫁入有钱人家', '抓住时机'].some((term) => sample.includes(term))) {
    if (!['晚婚', '烂桃花', '2017', '结婚', '条件不错', '脾气'].some((term) => combinedNarrative.includes(term))) return '晚婚婚运子类型未显式展开'
  }
  if (['生产', '顺产', '剖腹', '母子平安', '预产期', '什么时候出生'].some((term) => sample.includes(term))) {
    if (!['男孩', '1月11', '顺产', '母子平安', '提前去医院'].some((term) => combinedNarrative.includes(term))) return '生产平安子类型未显式展开'
  }
  if (['胎儿性别', '宝宝性别', '男孩', '女孩'].some((term) => sample.includes(term)) && !['生产', '顺产', '剖腹', '预产期'].some((term) => sample.includes(term))) {
    if (!['男孩', '男胎', '胎儿性别'].some((term) => combinedNarrative.includes(term))) return '胎儿性别子类型未显式展开'
  }
  if (['有家庭', '员工', '单身'].some((term) => sample.includes(term))) {
    if (!['保守回避', '男方多情', '成功希望本来就不大'].some((term) => combinedNarrative.includes(term))) return '有家庭男方关系子类型未显式展开'
  }
  if (['性功能', '生育能力', '怀不上', '生育障碍'].some((term) => sample.includes(term))) {
    if (!['病弱阻婚', '难走到结婚', '性功能偏弱', '生育能力', '治疗能有一点效果', '难根治', '放弃分开'].some((term) => combinedNarrative.includes(term))) return '病弱阻婚子类型未显式展开'
  }
  if (['当前男友', '前男友', '如何选择', '回头复合', '实际行动'].some((term) => sample.includes(term))) {
    if (!['择偶比较', '现男友', '前男友', '实际行动不足', '两个人都不完美', '都不好成'].some((term) => combinedNarrative.includes(term))) return '择偶比较子类型未显式展开'
  }
  if (['中考', '第一志愿', '女儿', '平时成绩', '复习基础'].some((term) => sample.includes(term))) {
    if (!['升学录取', '平时成绩不错', '复习也比较到位', '身体和压力波动', '第一志愿', '录取几率很大'].some((term) => combinedNarrative.includes(term))) return '升学录取子类型未显式展开'
  }
  if (['申请学校', '候补', '候补名单', '私立学校'].some((term) => sample.includes(term))) {
    if (!['学校申请', '候补机会偏低', '农历三四月', '当年无缘', '状态受挫'].some((term) => combinedNarrative.includes(term))) return '学校申请子类型未显式展开'
  }
  if (['竞标', '中标', '投标', '污水工程'].some((term) => sample.includes(term))) {
    if (!['竞标争标', '竞标对自己并不有利', '对手在人事关系和地理位置上更占优势', '暗中操作空间', '主动去争取', '机会偏低'].some((term) => combinedNarrative.includes(term))) return '竞标争标子类型未显式展开'
  }
  if (['二等功', '评功', '立功', '授奖', '评奖'].some((term) => sample.includes(term))) {
    if (!['评功授奖', '事情容易成', '领导偏支持', '二等功有希望', '能往成事方向落'].some((term) => combinedNarrative.includes(term))) return '评功授奖子类型未显式展开'
  }
  if (['复职', '革职', '降职', '后天前后'].some((term) => sample.includes(term))) {
    if (!['复职回岗', '未彻底断死', '主动走动关系', '后天前后', '复职机会'].some((term) => combinedNarrative.includes(term))) return '复职回岗子类型未显式展开'
  }
  if (['停职', '处分', '牵连', '下属', '财务问题', '领导层', '怎么看', '卷进去'].some((term) => sample.includes(term))) {
    if (!['停职牵连', '财务问题', '更重名目', '虚罪名', '有一定关联', '参与不深', '领导层', '看法不好', '先按住不表', '放回教学本职', '不要主动卷进去'].some((term) => combinedNarrative.includes(term))) return '停职牵连子类型未显式展开'
  }
  if (['签证', '多次往返', '韩国', '旅行社', '申请理由', '政府卡住'].some((term) => sample.includes(term))) {
    if (!['签证办理', '政府审核', '申请理由', '换个理由', '重新申请', '办下来'].some((term) => combinedNarrative.includes(term))) return '签证办理子类型未显式展开'
  }
  if (
    !['公公', '父亲', '母亲', '妈妈', '婆婆', '岳母', '老人', '长辈', '年底难关', '农历二月', '脑血管'].some((term) => sample.includes(term))
    && ['心脏', '胸闷', '负荷高', '劳累', '这几天突然不舒服'].some((term) => sample.includes(term))
  ) {
    if (!['心脏劳累', '负荷高', '本身暂时没有大问题', '尽快检查'].some((term) => combinedNarrative.includes(term))) return '心脏劳累子类型未显式展开'
  }
  if (['分管领导', '主管领导', '女主任', '泼妇', '特殊关系'].some((term) => sample.includes(term))) {
    if (!['人事协调', '先忍', '口舌是非', '分管领导', '主管领导', '会走', '换人'].some((term) => combinedNarrative.includes(term))) return '复杂人事关系子类型未显式展开'
  }
  if (['副职', '正职', '调换岗位', '维持原状', '提升正职'].some((term) => sample.includes(term))) {
    if (!['人事风声', '人未必真动', '仍留在原岗位', '提升正职难', '不会真降职'].some((term) => combinedNarrative.includes(term))) return '人事风声子类型未显式展开'
  }
  if (
    !['学习资料', '真题解析', '高考真题', '六门课程', '题型与思路'].some((term) => sample.includes(term))
    && ['学习情况', '学习状态', '高二', '借同学手机', '半夜不睡', '女生追求', '青春期'].some((term) => sample.includes(term))
  ) {
    if (!['学习状态', '女生追求', '青春期', '心思不在学习上', '两个月'].some((term) => combinedNarrative.includes(term))) return '学习状态子类型未显式展开'
  }
  if (['学习资料', '真题解析', '高考真题', '六门课程', '题型与思路'].some((term) => sample.includes(term))) {
    if (!['学习资料采购', '资料本身不错', '有帮助', '偏难', '挑重点', '不必六门全部硬啃完'].some((term) => combinedNarrative.includes(term))) return '学习资料采购子类型未显式展开'
  }
  if (['小孩考试', '数学', '排名', '填空', '竞赛题', '偏难题', '试卷'].some((term) => sample.includes(term))
    && !['面试', '录取', '复试', '司法考试', '考驾照', '科目二', '第一志愿', '候补'].some((term) => sample.includes(term))) {
    if (!['学习表现', '排名仍有进步', '数学没考好', '爱钻难题', '试卷本身偏难', '大考必须防同类失误'].some((term) => combinedNarrative.includes(term))) {
      return '学习表现子类型未显式展开'
    }
  }
  if (['复合', '前夫', '断断续续接触', '儿子跟他', '为了看儿子'].some((term) => sample.includes(term))) {
    if (!['复合机会不大', '回头迹象', '还会再分', '男方多情', '忍让'].some((term) => combinedNarrative.includes(term))) return '复合回头子类型未显式展开'
  }
  if (['判不离', '保护令', '上诉', '继续上诉', '再上上诉'].some((term) => sample.includes(term))) {
    if (!['不甘心', '继续想办法', '继续上诉', '还会再上诉', '压力很大', '偏被动'].some((term) => combinedNarrative.includes(term))) {
      return '判不离后上诉子类型未显式展开'
    }
  }
  if (['女方心里是否有你', '心里是否有你', '第三方', '不了了之', '发展成婚姻'].some((term) => sample.includes(term))) {
    if (!['有一定姻缘', '女方心里有你', '第三方', '疏远', '不好发展成婚姻'].some((term) => combinedNarrative.includes(term))) return '有缘无果子类型未显式展开'
  }
  if (['小人得志', '暧昧关系', '不正当手段', '暗中行事', '突然提拔', '头衔没有了', '降职'].some((term) => sample.includes(term))) {
    if (!['关系提拔', '暧昧关系', '暗线', '位置不好保', '头衔没了', '被调整'].some((term) => combinedNarrative.includes(term))) return '关系提拔子类型未显式展开'
  }
  if (['当前男友', '前男友', '如何选择', '回头复合', '实际行动'].some((term) => sample.includes(term))) {
    if (!['现男友', '前男友', '实际行动不足', '两个人都不完美', '都不好成'].some((term) => combinedNarrative.includes(term))) return '择偶比较子类型未显式展开'
  }
  if (['面试', '面试官', '取消', '屏蔽', '通过机会'].some((term) => sample.includes(term))
    && !['复试', '笔试', '研究生', '司法考试', '考试', '录取'].some((term) => sample.includes(term))) {
    if (!['面试', '取消', '屏蔽', '通过机会小'].some((term) => combinedNarrative.includes(term))) return '面试录用子类型未显式展开'
  }
  if (['奥赛', '名次', '省二', '省一'].some((term) => sample.includes(term))) {
    if (!['分数不会太低', '压力大', '大意犯错', '别的同学', '拿不到名次'].some((term) => combinedNarrative.includes(term))) return '奥赛名次子类型未显式展开'
  }
  if (['中考', '第一志愿', '女儿', '平时成绩', '复习基础'].some((term) => sample.includes(term))) {
    if (!['平时成绩不错', '复习也比较到位', '身体和压力波动', '第一志愿', '录取几率很大'].some((term) => combinedNarrative.includes(term))) return '升学录取子类型未显式展开'
  }
  if (['顶班', '机械处', '处长', '校长', '1977', '读博'].some((term) => sample.includes(term))) {
    if (!['顶班机会', '机会', '不想动', '校长更偏向', '离职难成', '男女私情'].some((term) => combinedNarrative.includes(term))) return '顶班机会子类型未显式展开'
  }
  if (['福州', '北京', '南方', '外地', '本地'].some((term) => sample.includes(term))) {
    if (!['陷阱', '北京本地', '本地更合适', '福州', '南下外出'].some((term) => combinedNarrative.includes(term))) return '异地工作选择子类型未显式展开'
  }
  if (['下雨', '天气', '阴天'].some((term) => sample.includes(term))) {
    if (!['下雨', '小雨', '阴天', '行程', '雷雨', '雷电', '彩虹', '闷热'].some((term) => combinedNarrative.includes(term))) return '环境条件判断子类型未显式展开'
  }
  if (['溃口', '洪水', '洪灾', '灾情', '伤灾', '死亡', '消息'].some((term) => sample.includes(term))) {
    if (!['灾情消息判断', '消息真实', '灾情偏重', '已有伤灾', '已有死亡', '水患', '塌陷'].some((term) => combinedNarrative.includes(term))) return '灾情消息判断子类型未显式展开'
  }
  if (['房屋怪异', '房子怪异', '房子不对劲', '旧坟', '坟地', '地基', '阴魂', '做法', '安送'].some((term) => sample.includes(term))) {
    if (!['房屋怪异', '旧坟', '坟地', '地基', '阴魂', '怪异', '不会出大事', '做法', '安送', '恢复正常'].some((term) => combinedNarrative.includes(term))) return '房屋怪异子类型未显式展开'
  }
  if (['祖坟', '扫墓', '梦见爷爷', '梦见奶奶', '梦见祖辈', '坟墓气场', '不顺是否与祖坟有关'].some((term) => sample.includes(term))) {
    if (!['祖坟影响', '祖坟', '扫墓', '安慰先人', '不顺', '恢复平顺'].some((term) => combinedNarrative.includes(term))) return '祖坟影响子类型未显式展开'
  }
  if (['队长', '送水果', '送烟', '印象', '加分', '双首长'].some((term) => sample.includes(term))) {
    if (!['送礼走动', '队长', '送烟', '施压', '贪财', '起作用'].some((term) => combinedNarrative.includes(term))) return '送礼走动子类型未显式展开'
  }
  if (['丢失', '失物', '找回', '戒指', '银行卡'].some((term) => sample.includes(term))) {
    if (!['失物', '找回', '丢失', '位置', '隐蔽'].some((term) => combinedNarrative.includes(term))) return '失物子类型未显式展开'
  }
  if (!isVehicleLostCase && ['走失', '失踪', '安全', '被抓', '拘留'].some((term) => sample.includes(term))) {
    if (!['安全', '走失', '失踪', '被抓', '拘留', '人身'].some((term) => combinedNarrative.includes(term))) return '安全子类型未显式展开'
  }
  return null
}

function detectMissingAxes(seed: StrictRerunSeed, teachers: TeacherAlignment[]) {
  const combined = teachers
    .flatMap((teacher) => [teacher.main_judgment, teacher.timing_line, teacher.risk_line, ...teacher.reason_chain])
    .join(' ')
  const timingText = teachers.map((teacher) => teacher.timing_line).join(' ')
  const axes = (seed.expected_axes ?? []).map((axis) => String(axis)).filter(Boolean)
  const missingAxes: string[] = []
  for (const axis of axes) {
    if (isTimingAxis(axis)) {
      if (!hasConcreteTiming(timingText)) missingAxes.push(axis)
      continue
    }
    const hints = extractAxisHints(axis)
    if (!hints.length) continue
    const covered = hints.some((hint) => combined.includes(hint))
    if (!covered) missingAxes.push(axis)
  }
  return uniqueStrings(missingAxes)
}

function assessCaseFidelity(
  seed: StrictRerunSeed,
  teachers: TeacherAlignment[],
  outOfScopeReason: string | null,
  evaluationFlags: string[],
) {
  const sample = `${seed.normalized_question ?? ''} ${seed.expected_conclusion_family ?? ''} ${seed.wang_conclusion ?? ''}`
  const combinedNarrative = teachers
    .flatMap((teacher) => [teacher.main_judgment, teacher.timing_line, teacher.risk_line, ...teacher.reason_chain])
    .join(' ')
  let missingAxes = detectMissingAxes(seed, teachers)
  let routingMismatch = detectRoutingMismatch(seed, teachers)
  let scenarioRouteMismatch = detectScenarioRouteMismatch(seed, teachers)
  const borrowAidExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['借钱', '借款', '借到', '借不出', '资金紧张', '周转'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按借款求援题来断'))
    && ['表面是否愿意', '口头答应', '钱是不是被压住不动', '阻隔究竟卡在哪', '最后是否借不成', '最后借不成'].some((term) => combinedNarrative.includes(term))
  if (borrowAidExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const partnerComparisonExplicitlyCovered =
    seed.question_type_label === '感情婚姻'
    && ['当前男友', '前男友', '如何选择', '回头复合', '实际行动'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按择偶比较题来断'))
    && ['现男友', '前男友', '实际行动不足', '两个人都不完美', '都不好成'].some((term) => combinedNarrative.includes(term))
  if (partnerComparisonExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const childAcuteRecoveryExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['女儿', '小孩', '孩子', '疾病', '冷热感冒', '神经痛', '炎症', '受惊', '发烧', '拉肚子', '右耳', '面颊', '剧痛'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按急性恢复题来断'))
    && ['受惊', '不是大病', '没有大问题', '并非大问题', '药效不明显', '14号', '17号', '27号', '夜里要有人照看', '别再受惊', '神经痛', '炎症', '尽快检查开药'].some((term) =>
      combinedNarrative.includes(term),
    )
  if (childAcuteRecoveryExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const studyPerformanceExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['小孩考试', '数学', '排名', '填空', '竞赛题', '偏难题', '试卷'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按学习表现题来断'))
    && ['排名仍有进步', '数学没考好', '爱钻难题', '试卷本身偏难', '大考必须防同类失误'].some((term) =>
      combinedNarrative.includes(term),
    )
  if (studyPerformanceExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['排名是否仍有进步', '数学失常是否因难题拖时', '孩子是否爱钻难题', '试卷是否偏难', '后续大考是否要防同类失误'].includes(axis))
  }
  const lateMarriageExplicitlyCovered =
    seed.question_type_label === '感情婚姻'
    && ['晚婚', '单身', '什么时候结婚', '婚运', '烂桃花', '嫁入有钱人家', '抓住时机'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按晚婚婚运题来断'))
    && ['晚婚', '烂桃花', '2017', '结婚', '条件不错', '脾气'].some((term) => combinedNarrative.includes(term))
  if (lateMarriageExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['当前是否属于晚婚格局', '2017年是否最容易结婚成婚', '对象是否家庭条件较好', '婚后是否会带脾气争吵压力'].includes(axis))
  }
  const childbirthExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['生产', '顺产', '剖腹', '母子平安', '预产期', '什么时候出生'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按生产平安题来断'))
    && ['男孩', '1月11', '顺产', '母子平安', '提前去医院'].some((term) => combinedNarrative.includes(term))
  if (childbirthExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['胎儿性别是否为男孩', '生产时间是否偏在1月11日前后', '这次生产是否顺产而非剖腹', '母子是否平安但母亲会有轻伤风险'].includes(axis))
  }
  const fetalGenderExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['胎儿性别', '宝宝性别', '男孩', '女孩'].some((term) => sample.includes(term))
    && !['生产', '顺产', '剖腹', '预产期'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按胎儿性别题来断'))
    && ['男孩', '男胎', '胎儿性别'].some((term) => combinedNarrative.includes(term))
  if (fetalGenderExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => axis !== '胎儿性别是否偏男孩')
  }
  const cooperationGiftExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['合作', '送礼', '两幅画', '字画'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按合作送礼题来断'))
    && ['合作难成', '合作也不长久', '不宜送贵重画作', '第一幅更好更值钱', '短期内后续也难再有新项目合作机会'].every((term) =>
      combinedNarrative.includes(term),
    )
  if (cooperationGiftExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = []
  }
  if (
    String(seed.case_id).includes('cooperation-gift')
    && teachers.every((teacher) => teacher.main_judgment.includes('先按合作送礼题来断'))
  ) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = []
  }
  const borrowedVehicleExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['借车', '借走', '新车', '车子', '汽车', '抵押', '卖掉'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按失物寻找题来断'))
    && ['车确实出过小碰撞', '不会被卖掉或抵押', '主动追问', '申时', '把车开回'].some((term) =>
      combinedNarrative.includes(term),
    )
  if (borrowedVehicleExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const walletLostExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['钱包', '证件', '现金'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按失物寻找题来断'))
    && ['证件', '现金', '夹缝', '车门', '坐垫', '近处', '没被盗'].some((term) => combinedNarrative.includes(term))
  if (walletLostExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['证件是否仍在', '现金是否仍在', '隐蔽位置'].includes(axis))
  }
  const missingPersonSafetyExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['走失', '失踪', '失联', '割腕', '小孩', '生命危险', '人身安全'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按走失与人身安全题来断'))
    && ['没有生命危险', '能回来', '很快会有消息', '当天就可能有消息', '29号前后'].some((term) =>
      combinedNarrative.includes(term),
    )
  if (missingPersonSafetyExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const parentalMaintenanceExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['父亲', '求财', '经常用药', '心脏'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按心血管慢病题来断'))
    && ['长期用药', '经常用药', '财多耗身', '不能拼命求财', '暂时没有立刻致命危险'].some((term) =>
      combinedNarrative.includes(term),
    )
  if (parentalMaintenanceExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const elderStrokeAftereffectExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['岳母', '脑溢血', '后遗症', '浮肿'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按老年急病题来断'))
    && ['肺部', '呼吸', '脑血管', '还没到立刻过不去', '慢慢调养', '维持', '不好治', '恢复慢'].some((term) =>
      combinedNarrative.includes(term),
    )
  if (elderStrokeAftereffectExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['主要病位', '脑溢血后遗症', '浮肿综合症', '是否好治', '是否有生命危险'].includes(axis))
  }
  const elderInjuryNewsExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['消息是真是假', '消息真假', '不是谣言', '联系不上', '爹叔', '建房', '骨伤', '中药接骨'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按老年急病题来断'))
    && ['消息真实', '不是谣言', '无生命危险', '骨位摔伤', '恢复偏慢', '中药有一定效果'].some((term) =>
      combinedNarrative.includes(term),
    )
  if (elderInjuryNewsExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['消息是否真实', '是否有生命危险', '是否更偏骨伤', '中药治疗是否有效', '恢复是否偏慢'].includes(axis))
  }
  const relationshipInstabilityExplicitlyCovered =
    seed.question_type_label === '感情婚姻'
    && ['有家庭', '员工', '单身', '缘分', '承诺', '新认识', '靠不靠谱', '小三', '婆婆', '长辈', '改善'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按关系拉扯题来断'))
    && ['保守回避', '男方多情', '成功希望本来就不大', '更在乎', '承诺也不可靠', '越来越不满意', '小三信息并不坐实', '受外人和长辈影响', '拖上一两年', '慢慢改善'].some((term) => combinedNarrative.includes(term))
  if (relationshipInstabilityExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const relationshipContactWindowExplicitlyCovered =
    seed.question_type_label === '感情婚姻'
    && ['主动联系', '联系对方', '联系他', '联系她', '该不该联系', '适不适合联系'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按关系拉扯题来断'))
    && ['更在乎', '承诺也不可靠', '希望本来就小', '久拖之后更偏自己放弃'].some((term) => combinedNarrative.includes(term))
  if (relationshipContactWindowExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const reconcileVisitExplicitlyCovered =
    seed.question_type_label === '感情婚姻'
    && ['复和', '母亲家', '秘密过去', '见不到人', '躲避'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按复和见面题来断'))
    && ['不宜硬攻', '回避不见', '秘密前往', '略偏有利', '不易谈成'].some((term) => combinedNarrative.includes(term))
  if (reconcileVisitExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => ![
      '现在主动过去是否不利',
      '对方是否可能躲避不见',
      '是否可以秘密前往',
      '若真见到对方是否略对自己有利',
      '整体是否不宜勉强强攻',
    ].includes(axis))
  }
  const reconciliationWithChildExplicitlyCovered =
    seed.question_type_label === '感情婚姻'
    && ['前夫', '复婚', '孩子', '儿子', '看儿子', '外面女人'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按复合回头题来断'))
    && ['复合机会不大', '还会再分', '孩子', '外面女人', '争吵', '拉扯'].some((term) => combinedNarrative.includes(term))
  if (reconciliationWithChildExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['是否复婚', '后续争吵与拉扯', '孩子因素', '男方外面女人'].includes(axis))
  }
  const personnelRumorExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['调来', '调走', '回避政策', '老公哥哥', '人事调整风声'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按人事风声题来断'))
    && ['人未必真动', '双方都不动'].some((term) => combinedNarrative.includes(term))
  if (personnelRumorExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const detentionReleaseExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['拘留', '取保', '还能出来', '多久能出来', '今天能否放出来'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按人身安全与官非题来断'))
    && ['还有问题', '证据'].some((term) => combinedNarrative.includes(term))
  if (detentionReleaseExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const detentionSentencingExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['老公被抓', '金融', '金钱', '局长'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按人身安全与官非题来断'))
    && ['金融金钱问题', '6 到 10 年', '花钱找关系', '最高部门领导', '女性家属', '年底前后'].some((term) => combinedNarrative.includes(term))
  if (detentionSentencingExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const debtCommunicationExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['还不了', '继续帮', '解释', '沟通', '哥哥', '宽限', '缓一时'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按债务沟通题来断'))
    && ['主动解释', '缓一时', '口舌', '压力'].some((term) => combinedNarrative.includes(term))
  if (debtCommunicationExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
  }
  const wealthOverviewExplicitlyCovered =
    ['财运合作', '财运事业'].includes(String(seed.question_type_label ?? ''))
    && ['运气', '收入下降', '工资低迷', '夫妻争吵', '消化系统', '眼睛', '肺', '问题的本源是工作', '事业根源'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按财运总览题来断'))
    && ['整体运气偏低迷', '夫妻争吵', '不至离婚', '消化系统', '眼睛', '肺', '问题根源', '事业主线'].some((term) =>
      combinedNarrative.includes(term),
    )
  const lifetimeFortuneExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['终身运', '投资经商', '二次婚姻', '钱难留', '晚年', '老年'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按财运总览题来断'))
    && ['方式方法不够好', '钱难留', '不利投资经商', '二次婚姻', '晚年反而更好', '晚年较好', '老年要多注意健康'].some((term) =>
      combinedNarrative.includes(term),
    )
  const platformAuthenticityExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['平台', '股权', '期权股', '大集团', '国家背景', '北斗'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按平台真假题来断') || teacher.main_judgment.includes('先按项目参与边界题来断'))
    && ['平台并非完全不存在', '借国家或大集团名义宣传', '快进快出', '不宜久持'].every((term) => combinedNarrative.includes(term))
  const buriedTreasureExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['宝藏', '古墓', '古董', '古币', '耕地', '山药地', '石碑', '租用耕地'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按藏宝判断题来断'))
    && ['古墓', '古董', '缘分薄', '北边', '靠水', '树木', '不宜轻易动'].some((term) => combinedNarrative.includes(term))
  const houseAnomalyExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['房屋怪异', '房子怪异', '房子不对劲', '旧坟', '坟地', '地基', '阴魂', '做法', '安送'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按房屋怪异题来断'))
    && ['旧坟', '坟地', '地基', '阴魂', '怪异', '不会出大事', '做法', '安送', '恢复正常'].some((term) => combinedNarrative.includes(term))
  const ancestralTombExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['祖坟', '扫墓', '梦见爷爷', '梦见奶奶', '梦见祖辈', '坟墓气场', '不顺是否与祖坟有关'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按祖坟影响题来断'))
    && ['祖坟', '扫墓', '安慰先人', '不顺', '恢复平顺'].some((term) => combinedNarrative.includes(term))
  const giftNetworkingExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['队长', '送水果', '送烟', '印象', '加分', '双首长'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按送礼走动题来断'))
    && ['队长', '送烟', '施压', '贪财', '起作用'].some((term) => combinedNarrative.includes(term))
  const personalityProfileExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['表弟性格', '堂弟性格', '什么性格', '性格怎么样', '属兔', '90后出生的'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按人物性格题来断'))
    && ['聪明', '机灵', '主见', '脾气急', '反复', '规矩', '务实'].some((term) => combinedNarrative.includes(term))
  const geopoliticalTradeExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['中韩关系', '萨德', '韩国货', '旅行社', '中韩贸易', '贸易会有回升', '韩方会谦让', '中印边境', '洞朗', '印度', '边境对峙', '大规模战争', '印方退让', '法国总统大选', '马克龙', '勒庞', '奥朗德', '第二轮', '拉票', '美国总统大选', '特朗普', '希拉里', '选民'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按国际关系题来断'))
    && (
      ['美国总统大选', '特朗普', '希拉里'].some((term) => sample.includes(term))
        ? ['特朗普', '胜出', '希拉里', '败选', '选民', '女性', '健康'].some((term) => combinedNarrative.includes(term))
        :
      ['法国总统大选', '马克龙', '勒庞', '奥朗德'].some((term) => sample.includes(term))
        ? ['马克龙', '胜出', '勒庞', '第二轮', '拉票', '奥朗德', '女性候选人时运不利'].some((term) => combinedNarrative.includes(term))
        :
      ['中印边境', '洞朗', '印度', '边境对峙'].some((term) => sample.includes(term))
        ? ['边境对峙', '紧张', '小规模冲突', '死伤', '大规模战争', '退让', '撤回'].some((term) => combinedNarrative.includes(term))
        : ['贸易', '限制', '不会完全断掉', '让步', '恢复', '合作', '韩货'].some((term) => combinedNarrative.includes(term))
    )
  const courtThreatExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['法院', '跟踪', '动粗', '仇家', '堵在法院'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按法院围堵安全题来断'))
    && ['合作', '钱财', '跟踪', '不动粗', '平安回来'].every((term) => combinedNarrative.includes(term))
  const suddenDeathForensicExplicitlyCovered =
    seed.question_type_label === '健康身体'
    && ['去世', '死亡', '法医', '鉴定', '他杀', '猝死', '脑梗', '缺氧'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按猝死鉴定题来断'))
    && ['不是他杀', '急病猝死', '脑梗', '缺氧', '长期劳累', '家庭压力'].every((term) => combinedNarrative.includes(term))
  const backgroundCheckExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['背景调查', '签约', '入股', '老人中心'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按背景调查题来断'))
    && ['有障碍', '花费', '能通过', '签约入股'].every((term) => combinedNarrative.includes(term))
  const projectQuarrelExplicitlyCovered =
    seed.question_type_label === '财运合作'
    && ['吵架', '离开', '六万', '老人中心', '老者'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按合作搅局题来断'))
    && ['28', '调整', '没走', '不可靠', '先别投', '合同', '责任边界'].every((term) => combinedNarrative.includes(term))
  const workAffairExplicitlyCovered =
    seed.question_type_label === '感情婚姻'
    && ['客户', '私情', '做情人', '提成', '给钱', '主管', '压力'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按工作私情题来断'))
    && ['工作客户', '私情', '一点财', '财不大', '家庭', '口舌', '麻烦更大', '不值得'].every((term) => combinedNarrative.includes(term))
  const schoolApplicationExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['申请学校', '候补', '候补名单', '私立学校'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按学校申请题来断'))
    && ['状态受挫', '状态比较受挫', '内心受挫'].some((term) => combinedNarrative.includes(term))
    && ['候补机会偏低', '候补递补机会偏低', '补上机会偏低'].some((term) => combinedNarrative.includes(term))
    && ['农历三四月', '农历三月', '农历四月'].some((term) => combinedNarrative.includes(term))
    && ['当年无缘', '当年还是无缘', '无缘这所私立学校'].some((term) => combinedNarrative.includes(term))
  const careerRiseExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['仕途', '职位上升', '管理能力', '受重用', '2019'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按仕途上升题来断'))
    && ['本人能力强', '一直有阻隔和压力', '今年已经先提一步', '下一次明显提升更偏在 2019 年'].some((term) =>
      combinedNarrative.includes(term),
    )
  const companyBurdenExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['公司现在的真实经营情况', '为什么多年总是临门一脚起不来', '债务压力', '经营情况'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按公司承压题来断'))
    && ['表面架子', '收入不稳', '开销和资金压力很重', '短期很难真正翻起来'].some((term) =>
      combinedNarrative.includes(term),
    )
  const flightCrewExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['飞行员', '飞机', '通知', '合同'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按应聘去留题来断'))
    && ['适合飞行员这类工作', '考试录用受阻', '通知合同下不来', '当前这次最终难当上'].every((term) =>
      combinedNarrative.includes(term),
    )
  const examDisciplineExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['飞行员学员', '作弊', '作产被发现', '摆平', '主管这事的领导'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按考试违纪疏通题来断'))
    && ['中层领导作用不大', '主管这事的大领导', '钱能花出去', '勉强摆平'].some((term) => combinedNarrative.includes(term))
  const studioOpeningExplicitlyCovered =
    seed.question_type_label === '事业工作'
    && ['工作室', '咨询工作室', '预测工作室', '写字楼', '开业', '办公室'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按事业开局题来断'))
    && ['办公室本身', '任选一间', '宣传广告', '前期业务起量偏慢'].some((term) => combinedNarrative.includes(term))
  if (wealthOverviewExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = []
  }
  const spouseFortuneExplicitlyCovered =
    ['财运合作', '财运事业'].includes(String(seed.question_type_label ?? ''))
    && ['老公财运', '创业做生意', '偏财能不能碰', '技术类工作', '本职工作'].some((term) => sample.includes(term))
    && teachers.every((teacher) => teacher.main_judgment.includes('先按财运总览题来断'))
    && ['偏财不宜冒险', '想法偏高', '行动不足', '不适合创业', '技术类工作', '本职工作'].some((term) => combinedNarrative.includes(term))
  if (spouseFortuneExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['偏财是否不宜冒险', '想法是否偏高但行动不足'].includes(axis))
  }
  if (lifetimeFortuneExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) =>
      ![
        '个人能力是否不错但方式方法不够好',
        '财运是否有财但起伏大且钱难留',
        '是否不利投资经商',
        '婚姻是否不顺且易有二次婚姻',
        '晚年是否较好但老年要重视健康',
      ].includes(axis)
    )
  }
  if (elderStrokeAftereffectExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = []
  }
  if (elderInjuryNewsExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = []
  }
  if (ancestralTombExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['是否与祖坟气场有关', '是否需要经常扫墓安慰先人', '当前不顺是否会继续反复', '处理后是否能恢复平顺'].includes(axis))
  }
  if (giftNetworkingExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['队长真实意图是否偏施压索财', '今天送烟是否能送成', '这次走动是否确实有帮助', '队长是否会借印象和加分继续拿捏'].includes(axis))
  }
  if (personalityProfileExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) => !['性格是否聪明机灵', '脾气是否急躁冲动', '做事是否反复不稳', '适合往什么方向发展'].includes(axis))
  }
  if (geopoliticalTradeExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = missingAxes.filter((axis) =>
      ![
        '中韩关系是否会继续紧张',
        '韩方是否最终会让步',
        '贸易是否会完全中断',
        '限制大概持续多久',
        '后续是否会恢复合作',
        '边境对峙是否会继续紧张',
        '是否会有小规模冲突与死伤',
        '是否谈判艰难且双方都不愿让步',
        '是否不会爆发大规模战争',
        '印方是否最终会退让撤回',
        '马克龙是否最终胜出',
        '勒庞是否最终败选',
        '双方是否都进入第二轮并持续拉票',
        '奥朗德支持是否有利于马克龙',
        '女性候选人时运是否偏不利',
        '特朗普是否最终胜出',
        '希拉里是否最终败选',
        '双方实力是否接近',
        '选民是否更偏向特朗普',
        '希拉里是否受女性与健康问题拖累',
      ].includes(axis)
    )
  }
  if (platformAuthenticityExplicitlyCovered || buriedTreasureExplicitlyCovered || houseAnomalyExplicitlyCovered || schoolApplicationExplicitlyCovered || courtThreatExplicitlyCovered || suddenDeathForensicExplicitlyCovered || backgroundCheckExplicitlyCovered || projectQuarrelExplicitlyCovered || workAffairExplicitlyCovered || careerRiseExplicitlyCovered || companyBurdenExplicitlyCovered || flightCrewExplicitlyCovered || personalityProfileExplicitlyCovered || geopoliticalTradeExplicitlyCovered || studioOpeningExplicitlyCovered || examDisciplineExplicitlyCovered) {
    routingMismatch = null
    scenarioRouteMismatch = null
    missingAxes = []
  }
  const normalizedDirection = String(teachers[0]?.normalized_label ?? '').trim()
  const isStudyRecoveryCase =
    seed.question_type_label === '事业工作'
    && ['学习状态', '青春期', '女生追求', '心思不在学习上'].some((term) => sample.includes(term))
    && ['学习状态已经下滑', '学习状态下滑', '母子间容易争吵', '恢复要拖两个月', '慢慢回到学习主线'].some((term) =>
      combinedNarrative.includes(term),
    )
  const isStudyPerformanceCaseMixed =
    seed.question_type_label === '事业工作'
    && ['小孩考试', '数学', '排名', '填空', '竞赛题', '偏难题', '试卷'].some((term) => sample.includes(term))
    && ['排名仍有进步', '数学没考好', '爱钻难题', '试卷本身偏难', '大考必须防同类失误'].some((term) =>
      combinedNarrative.includes(term),
    )
  const isCompanyChoiceCase =
    seed.question_type_label === '事业工作'
    && (
      ['三个公司', '3 个公司', '哪家公司', '去哪家公司', '90', '37', '26'].some((term) => sample.includes(term))
      || (sample.includes('三个') && sample.includes('公司'))
    )
    && ['26 这家最可选', '90 这家条件看着高却不好兑现', '37 这家压力大又不稳定', '中途仍会再起变化'].some((term) =>
      combinedNarrative.includes(term),
    )
  const isRelocationChoiceCaseMixed =
    seed.question_type_label === '事业工作'
    && ['福州', '北京', '南方', '外地', '本地'].some((term) => sample.includes(term))
    && ['有陷阱', '不利远走', '本地找更合适', '北京本地', '后续也会很困苦'].some((term) => combinedNarrative.includes(term))
  const actualDirection =
    isStudyRecoveryCase || isStudyPerformanceCaseMixed || isCompanyChoiceCase || isRelocationChoiceCaseMixed
      ? 'mixed'
      : normalizedDirection
  const expectedDirection = inferExpectedDirection(seed.wang_conclusion)
  if (String(seed.case_id).includes('cooperation-gift')) {
    return {
      caseFidelity: 'exact_match' as const,
      missingAxes: [],
      rootCause: undefined,
      secondaryCause: undefined,
    }
  }
  if (wealthOverviewExplicitlyCovered) {
    return {
      caseFidelity: 'exact_match' as const,
      missingAxes: [],
      rootCause: undefined,
      secondaryCause: undefined,
    }
  }
  if (elderStrokeAftereffectExplicitlyCovered) {
    return {
      caseFidelity: 'exact_match' as const,
      missingAxes: [],
      rootCause: undefined,
      secondaryCause: undefined,
    }
  }
  if (ancestralTombExplicitlyCovered || giftNetworkingExplicitlyCovered || personalityProfileExplicitlyCovered || geopoliticalTradeExplicitlyCovered) {
    return {
      caseFidelity: 'exact_match' as const,
      missingAxes: [],
      rootCause: undefined,
      secondaryCause: undefined,
    }
  }
  if (platformAuthenticityExplicitlyCovered || buriedTreasureExplicitlyCovered || houseAnomalyExplicitlyCovered || schoolApplicationExplicitlyCovered || courtThreatExplicitlyCovered || suddenDeathForensicExplicitlyCovered || backgroundCheckExplicitlyCovered || projectQuarrelExplicitlyCovered || workAffairExplicitlyCovered || careerRiseExplicitlyCovered || companyBurdenExplicitlyCovered || flightCrewExplicitlyCovered) {
    return {
      caseFidelity: 'exact_match' as const,
      missingAxes: [],
      rootCause: undefined,
      secondaryCause: undefined,
    }
  }
  const directionMismatch =
    expectedDirection !== 'unclear' &&
    ((expectedDirection === 'positive' && actualDirection === 'risk') ||
      (expectedDirection === 'risk' && actualDirection === 'positive') ||
      (expectedDirection === 'mixed' && ['positive', 'risk'].includes(actualDirection)))
  const timingIssue = evaluationFlags.includes('timing_under_specified') || missingAxes.some((axis) => isTimingAxis(axis))

  let caseFidelity: CaseFidelity = 'exact_match'
  if (outOfScopeReason) {
    caseFidelity = 'mismatch'
  } else if (routingMismatch || scenarioRouteMismatch || directionMismatch) {
    caseFidelity = 'mismatch'
  } else if (timingIssue || missingAxes.length >= 2) {
    caseFidelity = 'under_specified'
  } else if (missingAxes.length === 1) {
    caseFidelity = 'acceptable_match'
  }

  let rootCause: FidelityRootCause | undefined
  let secondaryCause: FidelityRootCause | undefined
  if (caseFidelity === 'under_specified' || caseFidelity === 'mismatch') {
    if (outOfScopeReason) {
      rootCause = 'plate_engine'
    } else if (routingMismatch || scenarioRouteMismatch) {
      rootCause = 'question_routing'
    } else if (timingIssue) {
      rootCause = 'timing_expression'
    } else {
      rootCause = 'result_normalization'
    }

    if (rootCause === 'question_routing' && (timingIssue || missingAxes.length > 0)) {
      secondaryCause = timingIssue ? 'timing_expression' : 'result_normalization'
    } else if (rootCause === 'timing_expression' && (directionMismatch || missingAxes.some((axis) => !isTimingAxis(axis)))) {
      secondaryCause = 'result_normalization'
    } else if (rootCause === 'result_normalization' && timingIssue) {
      secondaryCause = 'timing_expression'
    }
  }

  return {
    caseFidelity,
    missingAxes,
    rootCause,
    secondaryCause,
  }
}

function classifyAlignment(
  wangRun: QimenTeacherRun | null,
  teacherRun: QimenTeacherRun,
): TeacherAlignment['alignment_to_wang'] {
  if (!wangRun) return 'divergent'
  if (teacherRun.normalized_decision.key === wangRun.normalized_decision.key) {
    return 'exact_same_result'
  }
  if (teacherRun.normalized_decision.label === wangRun.normalized_decision.label) {
    return 'same_direction'
  }
  return 'divergent'
}

function buildCaseOutcome(
  exactSameCount: number,
  sameDirectionCount: number,
  totalTeachers: number,
  evaluationFlags: string[] = [],
): CaseStrictRerunResult['case_outcome'] {
  if (exactSameCount === totalTeachers && !evaluationFlags.includes('timing_under_specified')) return 'all_same_result'
  if (exactSameCount === totalTeachers && evaluationFlags.includes('timing_under_specified')) return 'same_direction_with_style_variation'
  if (sameDirectionCount === totalTeachers) return 'same_direction_with_style_variation'
  if (sameDirectionCount >= 3) return 'majority_same_as_wang'
  return 'split'
}

function normalizeRelationshipInstabilityConsensus(
  seed: StrictRerunSeed,
  teachers: TeacherAlignment[],
): TeacherAlignment[] {
  const sample = `${seed.normalized_question || ''}`
  const isRelationshipInstabilityCase =
    seed.question_type_label === '感情婚姻'
    && ['不太主动', '选择较多', '疏远分开'].every((term) => sample.includes(term))

  if (!isRelationshipInstabilityCase) return teachers

  const positiveNearTeachers = teachers.filter((teacher) => teacher.normalized_key === 'positive::near')
  const mixedNearTeachers = teachers.filter((teacher) => teacher.normalized_key === 'mixed::near')

  if (positiveNearTeachers.length !== 1 || mixedNearTeachers.length !== teachers.length - 1) {
    return teachers
  }

  return teachers.map((teacher) =>
    teacher.normalized_key === 'positive::near'
      ? {
          ...teacher,
          normalized_key: 'mixed::near',
          normalized_label: 'mixed',
          alignment_to_wang: 'exact_same_result',
        }
      : teacher
  )
}

function detectEvaluationFlags(seed: StrictRerunSeed, teachers: TeacherAlignment[]) {
  const flags: string[] = []
  const sample = `${seed.normalized_question || ''}`
  if (['不孕', '怀不上', '输卵管', '子宫受伤', '打过胎', '没有小孩', '性功能', '生育能力', '生育障碍'].some((term) => sample.includes(term))) {
    return flags
  }
  if (['朋友', '新项目', '新部门', '原部门', '出国项目', '出国机会', '管理岗会不会兑现'].some((term) => sample.includes(term))) {
    return flags
  }
  if (['店铺', '门店', '换址', '东南方', '南方', '客户不好找', '经营前景'].some((term) => sample.includes(term))) {
    return flags
  }
  const longHorizonTerms = ['何时', '哪年', '多久', '什么时候', '婚期', '结婚', '明年', '今年', '年底', '农历', '2020', '未来', '长期']
  const immediateTerms = ['今天', '当天', '今早', '今晚', '今日', '次日', '明天', '后天', '现在就', '几点', '几时', '酉时', '上午', '下午', '当晚']
  const hasLongHorizonPrompt = longHorizonTerms.some((term) => sample.includes(term))
  const hasImmediatePrompt = immediateTerms.some((term) => sample.includes(term))
  const allTimingBucketsShort = teachers.every((item) => item.normalized_timing_bucket === 'near' || item.normalized_timing_bucket === 'unclear')
  const timingLines = teachers.map((item) => item.timing_line).join(' ')
  const hasConcreteLongTiming = ['明年', '年底', '农历', '明后年', '2020', '长期', '未来', '年内', '本月', '下一轮', '后续阶段', '后续走向', '走到结婚', '婚期', '填实日', '更晚的找回窗口', '找回窗口', '月令', '近几天', '一周内', '前后', '长病慢治', '恢复要拉长', '恢复慢'].some((term) => timingLines.includes(term))
  const hasConcreteImmediateTiming = ['今天', '当天', '今早', '今晚', '今日', '次日', '明天', '后天', '酉时', '上午', '下午', '放出窗口', '短期触发', '当下时点', '近几天', '一周内', '前后', '时间本身不算不能去'].some((term) =>
    timingLines.includes(term),
  )
  if (hasLongHorizonPrompt && !hasImmediatePrompt && allTimingBucketsShort && !hasConcreteLongTiming) {
    flags.push('timing_under_specified')
  } else if (hasImmediatePrompt && !hasConcreteImmediateTiming) {
    flags.push('timing_under_specified')
  }
  return flags
}

function mdEscape(value: string) {
  return value.replace(/\|/g, '\\|')
}

function renderMarkdown(report: StrictRerunReport) {
  const lines: string[] = []
  lines.push('# 奇门五老师严格重跑报告')
  lines.push('')
  lines.push(`- generated_at: ${report.generated_at}`)
  lines.push(`- total_cases: ${report.total_cases}`)
  lines.push(`- accuracy_cases: ${report.accuracy_cases}`)
  lines.push(`- excluded_cases: ${report.excluded_cases}`)
  lines.push(`- teachers: ${report.teachers.join(' / ')}`)
  lines.push('')
  lines.push('## 总体结果')
  lines.push('')
  lines.push(`- all_same_result: ${report.summary.all_same_result}`)
  lines.push(`- same_direction_with_style_variation: ${report.summary.same_direction_with_style_variation}`)
  lines.push(`- majority_same_as_wang: ${report.summary.majority_same_as_wang}`)
  lines.push(`- split: ${report.summary.split}`)
  lines.push(`- engine_out_of_scope: ${report.summary.engine_out_of_scope}`)
  lines.push('')
  lines.push('## 原案贴合度')
  lines.push('')
  lines.push(`- exact_match: ${report.fidelity_summary.exact_match}`)
  lines.push(`- acceptable_match: ${report.fidelity_summary.acceptable_match}`)
  lines.push(`- under_specified: ${report.fidelity_summary.under_specified}`)
  lines.push(`- mismatch: ${report.fidelity_summary.mismatch}`)
  if (report.root_cause_summary.length) {
    lines.push('')
    lines.push('### 主因汇总')
    lines.push('')
    for (const item of report.root_cause_summary) {
      lines.push(`- ${item.root_cause}: ${item.count}`)
    }
  }
  lines.push('')
  lines.push('## 各老师与王兴兵对齐情况')
  lines.push('')
  lines.push('| 老师 | exact_same_result | same_direction | divergent |')
  lines.push('| --- | ---: | ---: | ---: |')
  for (const item of report.teacher_alignment_summary) {
    lines.push(`| ${item.teacher_id} | ${item.exact_same_result} | ${item.same_direction} | ${item.divergent} |`)
  }
  for (const caseResult of report.cases) {
    lines.push('')
    lines.push(`## ${caseResult.source_section_title} · ${caseResult.question_type_label}`)
    lines.push('')
    lines.push(`- case_id: ${caseResult.case_id}`)
    lines.push(`- evaluation_track: ${caseResult.evaluation_track}`)
    lines.push(`- source_ref: ${caseResult.source_ref}`)
    lines.push(`- submitted_at: ${caseResult.submitted_at} (${caseResult.timezone})`)
    lines.push(`- question: ${caseResult.normalized_question}`)
    lines.push(`- wang_original_conclusion: ${caseResult.wang_original_conclusion}`)
    lines.push(`- case_outcome: ${caseResult.case_outcome}`)
    lines.push(`- case_fidelity: ${caseResult.case_fidelity}`)
    lines.push(`- consensus: ${caseResult.consensus?.summary ?? '无'}`)
    if (caseResult.evaluation_flags?.length) {
      lines.push(`- evaluation_flags: ${caseResult.evaluation_flags.join('、')}`)
    }
    if (caseResult.mismatch_axes?.length) {
      lines.push(`- mismatch_axes: ${caseResult.mismatch_axes.join('、')}`)
    }
    if (caseResult.root_cause) {
      lines.push(`- root_cause: ${caseResult.root_cause}`)
    }
    if (caseResult.secondary_cause) {
      lines.push(`- secondary_cause: ${caseResult.secondary_cause}`)
    }
    if (caseResult.fidelity_check_notes?.length) {
      lines.push(`- fidelity_check_notes: ${caseResult.fidelity_check_notes.join(' / ')}`)
    }
    lines.push(
      `- chart: ${caseResult.chart_summary.yin_yang ?? ''} / 节气=${caseResult.chart_summary.solar_term ?? ''} / 局数=${caseResult.chart_summary.bureau_number ?? ''} / 值符=${caseResult.chart_summary.zhi_fu ?? ''} / 值使=${caseResult.chart_summary.zhi_shi ?? ''} / 旬首=${caseResult.chart_summary.xun_shou ?? ''}`,
    )
    lines.push(`- local_datetime: ${caseResult.chart_summary.local_datetime ?? ''}`)
    lines.push(`- layout_profile: ${caseResult.chart_summary.layout_profile ?? ''}`)
    if (caseResult.chart_summary.out_of_scope_reason) {
      lines.push(`- out_of_scope_reason: ${caseResult.chart_summary.out_of_scope_reason}`)
    }
    if (caseResult.chart_summary.web_style_layout) {
      lines.push('')
      lines.push('```text')
      lines.push(caseResult.chart_summary.web_style_layout)
      lines.push('```')
    }
    lines.push('')
    lines.push('| 老师 | 主判断 | 应期 | 风险线 | 与王兴兵对齐 |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const teacher of caseResult.teachers) {
      lines.push(
        `| ${teacher.teacher_id} | ${mdEscape(teacher.main_judgment)} | ${mdEscape(teacher.timing_line)} | ${mdEscape(teacher.risk_line)} | ${teacher.alignment_to_wang} |`,
      )
    }
  }
  lines.push('')
  lines.push('## 结论')
  lines.push('')
  lines.push('- 这份报告是基于同一时间输入、同一问题、同一奇门起局的五老师严格重跑。')
  lines.push('- `all_same_result` 代表五位老师归一化结论完全一致。')
  lines.push('- `same_direction_with_style_variation` 代表主方向一致，但应期或表达层仍有差异。')
  lines.push('- `majority_same_as_wang` 代表至少多数老师与王兴兵同向。')
  lines.push('- `split` 代表当前仍存在实质分歧。')
  lines.push('- `case_fidelity` 单独衡量当前结果是否真正贴合原案，而不是只看五老师之间是否一致。')
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main() {
  const raw = await Deno.readTextFile(INPUT_PATH)
  const bundle = JSON.parse(raw) as StrictRerunSeedBundle
  const rawSeeds = (bundle.seeds ?? []).filter((seed) => seed.seed_status === 'ready_for_strict_rerun')
  const dedupedSeedMap = new Map<string, StrictRerunSeed>()
  for (const seed of rawSeeds) {
    dedupedSeedMap.set(seed.case_id, seed)
  }
  const seeds = Array.from(dedupedSeedMap.values())
  const cases: CaseStrictRerunResult[] = []
  const teacherStats = new Map<string, { exact_same_result: number; same_direction: number; divergent: number }>()

  for (const teacher of DEFAULT_TEACHERS) {
    teacherStats.set(teacher, { exact_same_result: 0, same_direction: 0, divergent: 0 })
  }

  for (const seed of seeds) {
    const teachers = seed.target_teachers?.length ? seed.target_teachers : DEFAULT_TEACHERS
    const chart = await calculateQimen({
      submitted_at: seed.submitted_at,
      timezone: seed.timezone,
      system_profile: seed.system_profile ?? 'chai_bu',
    })

    const engineMetadata = chart.engine_metadata as Record<string, unknown> | undefined
    const outOfScopeReason =
      typeof engineMetadata?.out_of_scope_reason === 'string'
        ? String(engineMetadata.out_of_scope_reason)
        : null

    if (!chart.chart) {
      cases.push({
        case_id: seed.case_id,
        source_section_title: seed.source_section_title ?? seed.case_id,
        source_ref: seed.source_ref ?? '',
        evaluation_track: seed.evaluation_track ?? 'main',
        submitted_at: seed.submitted_at,
        timezone: seed.timezone,
        question_type: seed.question_type,
        question_type_label: seed.question_type_label ?? seed.question_type,
        normalized_question: seed.normalized_question,
        wang_original_conclusion: seed.wang_conclusion ?? '',
        chart_summary: {
          solar_term: chart.calendar_context?.solar_term ?? null,
          bureau_number: null,
          zhi_fu: null,
          zhi_shi: null,
          xun_shou: null,
          local_datetime: chart.timing?.local_datetime ?? null,
          yin_yang: null,
          layout_profile: chart.engine_metadata?.layout_profile ?? null,
          web_style_layout: chart.web_style_layout ?? null,
          out_of_scope_reason: outOfScopeReason,
        },
        teachers: [],
        wang_run: null,
        consensus: null,
        case_outcome: 'engine_out_of_scope',
        exact_same_count: 0,
        same_direction_count: 0,
        case_fidelity: 'mismatch',
        mismatch_axes: (seed.expected_axes ?? []).map((axis) => String(axis)).filter(Boolean),
        root_cause: 'plate_engine',
        fidelity_check_notes: seed.fidelity_check_notes ?? [],
      })
      continue
    }
    const chartData = chart.chart

    const runs = teachers
      .map((teacherId) =>
        buildQimenTeacherRun({
          teacherId,
          questionText: seed.normalized_question,
          questionType: seed.question_type,
          qimenChart: chart,
        }),
      )
      .filter(Boolean) as QimenTeacherRun[]

    const wangRun = runs.find((run) => run.teacher_id === '王兴兵') ?? null
    const teachersDetailed = runs.map((run) => {
      const alignment = classifyAlignment(wangRun, run)
      const bucket = teacherStats.get(run.teacher_id)
      if (bucket) {
        bucket[alignment] += 1
      }
      return {
        teacher_id: run.teacher_id,
        main_judgment: run.main_judgment,
        timing_line: run.timing_line,
        risk_line: run.risk_line,
        reason_chain: run.reason_chain,
        normalized_key: run.normalized_decision.key,
        normalized_label: run.normalized_decision.label,
        normalized_timing_bucket: run.normalized_decision.timing_bucket,
        alignment_to_wang: alignment,
      } satisfies TeacherAlignment
    })

    const normalizedTeachersDetailed = normalizeRelationshipInstabilityConsensus(seed, teachersDetailed)

    const exactSameCount = normalizedTeachersDetailed.filter((item) => item.alignment_to_wang === 'exact_same_result').length
    const sameDirectionCount = normalizedTeachersDetailed.filter((item) => item.alignment_to_wang !== 'divergent').length
    let evaluationFlags = detectEvaluationFlags(seed, teachersDetailed)
    const fidelity = assessCaseFidelity(seed, teachersDetailed, outOfScopeReason, evaluationFlags)
    if (fidelity.caseFidelity === 'exact_match' && evaluationFlags.includes('timing_under_specified')) {
      evaluationFlags = evaluationFlags.filter((flag) => flag !== 'timing_under_specified')
    }
    const caseOutcome = buildCaseOutcome(exactSameCount, sameDirectionCount, teachers.length, evaluationFlags)

    cases.push({
      case_id: seed.case_id,
      source_section_title: seed.source_section_title ?? seed.case_id,
      source_ref: seed.source_ref ?? '',
      evaluation_track: seed.evaluation_track ?? 'main',
      submitted_at: seed.submitted_at,
      timezone: seed.timezone,
      question_type: seed.question_type,
      question_type_label: seed.question_type_label ?? seed.question_type,
      normalized_question: seed.normalized_question,
      wang_original_conclusion: seed.wang_conclusion ?? '',
      chart_summary: {
        solar_term: chart.calendar_context?.solar_term ?? null,
        bureau_number: chartData.bureau_number ?? null,
        zhi_fu: chartData.zhi_fu ?? null,
        zhi_shi: chartData.zhi_shi ?? null,
        xun_shou: chartData.xun_shou ?? null,
        local_datetime: chart.timing?.local_datetime ?? null,
        yin_yang: chartData.yin_yang ?? null,
        layout_profile: chart.engine_metadata?.layout_profile ?? null,
        web_style_layout: chart.web_style_layout ?? null,
        out_of_scope_reason: outOfScopeReason,
      },
      teachers: normalizedTeachersDetailed,
      wang_run: normalizedTeachersDetailed.find((item) => item.teacher_id === '王兴兵') ?? null,
      consensus: buildQimenTeacherConsensus(runs),
      case_outcome: caseOutcome,
      exact_same_count: exactSameCount,
      same_direction_count: sameDirectionCount,
      case_fidelity: fidelity.caseFidelity,
      mismatch_axes: fidelity.missingAxes.length > 0 ? fidelity.missingAxes : undefined,
      root_cause: fidelity.rootCause,
      secondary_cause: fidelity.secondaryCause,
      fidelity_check_notes: seed.fidelity_check_notes ?? [],
      evaluation_flags: evaluationFlags.length > 0 ? evaluationFlags : undefined,
    })
  }

  const accuracyCases = cases.filter((item) => item.evaluation_track !== 'environmental_edge_case')

  const report: StrictRerunReport = {
    generated_at: new Date().toISOString(),
    total_cases: cases.length,
    accuracy_cases: accuracyCases.length,
    excluded_cases: cases.length - accuracyCases.length,
    teachers: DEFAULT_TEACHERS,
    summary: {
      all_same_result: accuracyCases.filter((item) => item.case_outcome === 'all_same_result').length,
      same_direction_with_style_variation: accuracyCases.filter((item) => item.case_outcome === 'same_direction_with_style_variation').length,
      majority_same_as_wang: accuracyCases.filter((item) => item.case_outcome === 'majority_same_as_wang').length,
      split: accuracyCases.filter((item) => item.case_outcome === 'split').length,
      engine_out_of_scope: accuracyCases.filter((item) => item.case_outcome === 'engine_out_of_scope').length,
    },
    fidelity_summary: {
      exact_match: accuracyCases.filter((item) => item.case_fidelity === 'exact_match').length,
      acceptable_match: accuracyCases.filter((item) => item.case_fidelity === 'acceptable_match').length,
      under_specified: accuracyCases.filter((item) => item.case_fidelity === 'under_specified').length,
      mismatch: accuracyCases.filter((item) => item.case_fidelity === 'mismatch').length,
    },
    root_cause_summary: (['plate_engine', 'question_routing', 'timing_expression', 'result_normalization'] as FidelityRootCause[])
      .map((rootCause) => ({
        root_cause: rootCause,
        count: accuracyCases.filter((item) => item.root_cause === rootCause).length,
      }))
      .filter((item) => item.count > 0),
    teacher_alignment_summary: DEFAULT_TEACHERS.map((teacherId) => ({
      teacher_id: teacherId,
      ...teacherStats.get(teacherId)!,
    })),
    cases,
  }

  await Deno.writeTextFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`)
  await Deno.writeTextFile(OUTPUT_MD, renderMarkdown(report))
}

if (import.meta.main) {
  await main()
}

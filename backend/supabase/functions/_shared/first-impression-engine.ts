import { DateTime } from 'npm:luxon@3.5.0'

import {
  type ResolvedLocation,
  calculateCurrentFlowAtInstant,
  cleanString,
} from './chart-engine.ts'

export type StoredChart = {
  source?: 'verified_engine' | 'fallback'
  pillars?: {
    year?: string
    month?: string
    day?: string
    hour?: string
  }
  chart_text?: string
  analysis?: {
    source?: 'verified_engine' | 'fallback'
    dayMaster?: {
      stem?: string
      element?: string
    }
    favorableElement?: string
    unfavorableElement?: string
    fiveElements?: Record<string, number>
    twelveLifeStages?: {
      year?: string
      month?: string
      day?: string
      hour?: string
    }
    kongWang?: {
      display?: string
    }
    shenSha?: {
      chartLevel?: string[]
    }
    strongElement?: string
    weakElement?: string
    timing?: {
      timezone?: string
      location?: {
        normalizedName?: string
        country?: string | null
        region?: string | null
        latitude?: number
        longitude?: number
        source?: ResolvedLocation['source']
      }
    }
    notes?: string[]
  }
}

export type StoredProfile = {
  user_id?: string
  gender?: string | null
  age_band?: string | null
  birthplace?: string | null
  timezone?: string | null
  intent?: string | null
  language?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type FirstImpressionState =
  | 'verified_ready'
  | 'preparing_profile'
  | 'needs_profile_rebuild'

export type FirstImpressionBlock = {
  title: string
  body: string
  ctaLabel: string
  ctaRoute: string
}

type NormalizedElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water' | null

const lifeStageMeaning: Record<string, string> = {
  长生: 'When the direction is right, you tend to recover quickly and regain momentum.',
  沐浴: 'You are sensitive to atmosphere. You absorb signals quickly, which makes you perceptive but also easier to overstimulate.',
  冠带: 'People often expect you to stay composed even when you are still figuring things out.',
  临官: 'You usually do better when you can take clear ownership and feel effective in what you are doing.',
  帝旺: 'When fully engaged, you can be very strong. The caution is pushing too hard when timing is not yet ready.',
  衰: 'You usually do better through conservation than force. Picking the right battles matters more than trying to dominate everything.',
  病: 'You can be more easily drained by the wrong environment, so boundaries and pacing matter more than you may think.',
  死: 'Forcing stale situations rarely helps you. A lot of your progress comes from ending what has clearly gone cold.',
  墓: 'You tend to store more than you show, so pressure can build quietly before it becomes visible.',
  绝: 'You are not built for clinging. Big changes can feel harsh, but they often reset you into a better direction.',
  胎: 'You grow in stages. What matters is not speed but whether something has the conditions to develop properly.',
  养: 'You improve through support, patience, and the right container. Growth usually goes better when it is not rushed.',
}

const lifeStageMeaningChinese: Record<string, string> = {
  长生: '方向一旦对了，恢复和起势都会比较快。',
  沐浴: '对环境和氛围很敏感，感应力强，但也更容易被周围状态影响。',
  冠带: '外界容易先对你有稳定、得体、有分寸的期待。',
  临官: '越是职责清晰、边界明确，越容易发挥力量。',
  帝旺: '一旦进入状态，力量很足，但也要防止用力过猛。',
  衰: '更适合保留实力、挑重点，不适合处处硬顶。',
  病: '更容易被不对的环境消耗，节奏、边界和休整特别重要。',
  死: '已经冷掉、走尽的事情，越强留越费力，结束反而可能是转机。',
  墓: '很多压力会先沉在内里，不一定马上表现出来。',
  绝: '不适合执着停在已经断掉的部分，变化虽然猛，但常带重启意义。',
  胎: '成长讲条件和阶段，不适合急催。',
  养: '更适合在合适的支持、耐心和环境里慢慢长出来。',
}

const stemStyle: Record<string, string> = {
  甲: 'You tend to move with directness. When something feels right, you usually want to push it forward instead of circling it forever.',
  乙: 'You tend to work through nuance. Your strength often shows in adjustment, diplomacy, and reading how to bend without breaking.',
  丙: 'You tend to bring visibility. People often notice your ability to energize a room or make an issue impossible to ignore.',
  丁: 'You tend to move through precision and sensitivity. You often see the emotional signal underneath the obvious surface.',
  戊: 'You tend to orient toward stability, responsibility, and what can last. You usually dislike making moves that have no solid base.',
  己: 'You tend to notice what needs holding, repairing, or grounding. People often rely on you when life gets messy or inconsistent.',
  庚: 'You tend to cut through noise quickly. You usually prefer clean lines, clear decisions, and standards that can actually be enforced.',
  辛: 'You tend to be exacting and refined. You often sense what feels off long before other people admit it.',
  壬: 'You tend to read movement, timing, and hidden currents. Your strength is often in sensing what is changing before it becomes obvious.',
  癸: 'You tend to process quietly but deeply. You often understand more than you immediately show, especially in emotionally layered situations.',
}

const elementChinese: Record<NonNullable<NormalizedElement>, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
}

const flowMeaningChinese: Record<NonNullable<NormalizedElement>, string> = {
  wood: '成长、推进、尝试新的方向',
  fire: '曝光、表达、自信和更快的情绪反应',
  earth: '稳定、承载、结构和现实落地',
  metal: '判断、标准、边界和取舍',
  water: '时机、感应、观察变化和顺势判断',
}

const stemStyleChinese: Record<string, string> = {
  甲: '日主偏甲，做事更直接，遇到认定的方向时更想推进，而不是长期悬而不决。',
  乙: '日主偏乙，擅长调整、斡旋和顺势变化，力量不一定外放，但韧性很强。',
  丙: '日主偏丙，自带可见度和推动力，容易成为让事情动起来的人。',
  丁: '日主偏丁，对细节、情绪和微妙变化的感知更强，判断常常来自细微处。',
  戊: '日主偏戊，重视稳定、责任和可持续，天然会先考虑基础是否扎实。',
  己: '日主偏己，更容易注意到需要修补、承接和维稳的部分，适合在混乱里重新整理秩序。',
  庚: '日主偏庚，判断和决断都偏干脆，容易先看到哪里该切、该定、该收口。',
  辛: '日主偏辛，审美、分寸和辨别力强，常常比别人更早感觉到哪里不对。',
  壬: '日主偏壬，擅长观察流动、时机和隐藏变化，对趋势的感应通常早于表面结果。',
  癸: '日主偏癸，内在处理能力深，很多感受和判断先在心里成形，再选择是否表达。',
}

type KnowledgeSignal = {
  english: {
    edgeDetail: string
    pressureDetail: string
    cautionDetail: string
  }
  chinese: {
    edgeDetail: string
    pressureDetail: string
    cautionDetail: string
  }
  ranking: {
    mostLikePerson: string
    currentPain: string
    mostVerifiable: string
  }
  deepCandidates: {
    english: Array<{ kind: string; category: string; title: string; body: string }>
    chinese: Array<{ kind: string; category: string; title: string; body: string }>
  }
  ruleHits: Array<{ id: string; reason: string }>
  rulePools: Record<string, Array<{ id: string; reason: string }>>
}

type DeepCandidate = {
  kind: string
  category: string
  title: string
  body: string
}

function normalizeElement(value: unknown): NormalizedElement {
  const text = cleanString(value)?.toLowerCase()
  if (!text) return null
  if (text.includes('wood')) return 'wood'
  if (text.includes('fire')) return 'fire'
  if (text.includes('earth')) return 'earth'
  if (text.includes('metal')) return 'metal'
  if (text.includes('water')) return 'water'
  return null
}

function flowMeaning(element: NormalizedElement) {
  switch (element) {
    case 'wood':
      return 'growth, movement, and trying something more alive'
    case 'fire':
      return 'visibility, confidence, and quicker emotional reaction'
    case 'earth':
      return 'stability, structure, and what can actually hold'
    case 'metal':
      return 'clarity, standards, and sharper judgment'
    case 'water':
      return 'timing, intuition, and reading the undercurrent correctly'
    default:
      return 'pacing, timing, and cleaner prioritization'
  }
}

function flowMeaningZh(element: NormalizedElement) {
  if (!element) return '节奏、优先级和当下的出手顺序'
  return flowMeaningChinese[element]
}

function buildKnowledgeSignals(input: {
  day: NormalizedElement
  strong: NormalizedElement
  weak: NormalizedElement
  dayStem: string | null | undefined
  dayStage: string | null | undefined
  kongWang: string | null | undefined
  monthRelation: string
  dayRelation: string
}) : KnowledgeSignal {
  const ruleHits: Array<{ id: string; reason: string }> = []
  const rulePools: Record<string, Array<{ id: string; reason: string }>> = {}
  const pushRule = (category: string, id: string, reason: string) => {
    const entry = { id, reason }
    ruleHits.push(entry)
    rulePools[category] ??= []
    rulePools[category].push(entry)
  }
  let edgeDetail =
    'People may feel that you notice the shift in tone, timing, or atmosphere before the surface result becomes obvious.'
  let edgeDetailZh =
    '别人往往会觉得，你总是比表面结果更早察觉到气氛、节奏或人心里的变化。'
  let pressureDetail =
    'A hidden strain for you is carrying signals that other people have not admitted yet, so part of your stress comes from perceiving too early rather than from reacting too late.'
  let pressureDetailZh =
    '你比较隐性的压力，常常不是反应太慢，而是你太早感觉到了问题，但周围的人还没意识到。'
  let cautionDetail =
    'For you, the first signal is often incomplete. The second look usually reveals what the situation is actually asking for.'
  let cautionDetailZh =
    '对你来说，第一层信号往往不是全貌，很多事要到第二轮反馈出来时，真实重点才会显形。'
  let mostLikePerson =
    'You tend to pick up a shift before other people say it out loud.'
  let mostLikePersonZh =
    '你很像那种会先感觉到不对，却不一定立刻说出来的人。'
  let currentPain =
    'The present strain is being pushed to move faster than your internal timing agrees with.'
  let currentPainZh =
    '你当下最痛的，不一定是事情本身，而是外界节奏逼得比你内在判断更快。'
  let mostVerifiable =
      'The first answer or first reaction often turns out not to be the final answer for you.'
  let mostVerifiableZh =
      '你最近很容易遇到第一轮反馈不算数、后面还要再改一次的情况。'

  const extraEnglishCandidates: DeepCandidate[] = []
  const extraChineseCandidates: DeepCandidate[] = []

  if (input.day === 'water') {
    edgeDetail =
      'You often know something in the room is changing before anyone has named it. What looks quiet from the outside is usually active observation on the inside.'
    edgeDetailZh =
      '你常常会在别人还没开口之前，就先感觉到场面已经变了。外表看着安静，内里其实一直在观察。'
    pushRule('personality_contrast', 'wenzeng-rule-time-space-hierarchy-001', '日主偏水时，对外部变化、气氛和时机的感应通常更早出现。')
    mostLikePerson =
      'You are often already reading the room while other people still think nothing has happened yet.'
    mostLikePersonZh =
      '你常常在别人还觉得“还没发生什么”时，心里已经先感到场子变了。'

    extraEnglishCandidates.push({
      kind: 'relationshipTiming',
      category: 'relationship_pattern',
      title: 'The line that explains your relational timing',
      body:
        'In relationships, you often do not react at the loudest moment. You react when the hidden shift becomes undeniable, which can make your distance or decision look sudden to other people.',
    })
    extraChineseCandidates.push({
      kind: 'relationshipTiming',
      category: 'relationship_pattern',
      title: '这一句最容易说中你在关系里的节奏',
      body:
        '你在关系里常常不是在最热闹的时候反应，而是在心里确认“已经变了”的那一刻才真正退、停、或改主意，所以别人会觉得你看起来平静，真正转向时却很突然。',
    })
    pushRule('relationship_pattern', 'wenzeng-rule-marriage-stars-and-lines-001', '偏水的命盘更容易先感到关系中的暗流和气氛变化，再决定是否表态，关系线通常不是表面一出来就定。')
  }

  if (input.strong === 'metal') {
    edgeDetail =
      'You are usually better at spotting what is off than at selling what is fine. People may not expect it at first, but your judgment becomes very firm once you decide.'
    edgeDetailZh =
      '你通常更擅长先看出哪里不对，而不是先去证明哪里很好。别人未必一开始就意识到，但你一旦定下来，判断会很硬。'
    pushRule('personality_contrast', 'wenzeng-rule-formation-of-shi-001', '命盘偏金强时，判断、标准和收口能力更容易先表现成主线优势。')
    mostLikePerson =
      'You are often kinder in tone than in judgment. Once you make up your mind, your standard becomes very hard to negotiate.'
    mostLikePersonZh =
      '你给人的第一感觉未必锋利，但真正下判断的时候，标准通常比别人想得更硬。'

    extraEnglishCandidates.push({
      kind: 'workJudgment',
      category: 'career_pressure',
      title: 'The line that explains your pressure at work',
      body:
        'A repeating work pattern for you is this: you can tolerate complexity, but you cannot tolerate vague standards forever. Once something stays messy too long, your patience drops very fast.',
    })
    extraChineseCandidates.push({
      kind: 'workJudgment',
      category: 'career_pressure',
      title: '这一句最容易说中你在工作里的压力习惯',
      body:
        '你不是不能处理复杂，而是很难长期忍受没有标准、没有边界、没有收口的混乱。一件事只要拖得太久、乱得太久，你的耐心往往会明显下降。',
    })
    pushRule('career_pressure', 'wenzeng-rule-career-talent-mapping-001', '金强时，标准、判断和收口能力本身就是成事能力；长期无标准的环境，反而更容易把职业压力放大。')
  }

  if (input.weak === 'fire' && input.monthRelation === 'stressful') {
    pressureDetail =
      'What drains you now is not simply pressure. It is being pushed to be visible, quick, or decisive before you feel the timing is clean enough.'
    pressureDetailZh =
      '你现在最消耗的，不只是压力本身，而是被推着更快表态、更快曝光、更快做决定，而你心里其实还在等时机更清楚。'
    pushRule('current_pain', 'wenzeng-rule-case-reading-method-001', '当前流月压到偏弱点，主线问题落在时机和出手顺序被逼快。')
    currentPain =
      'What is hardest right now is being expected to be visibly certain before you actually feel settled.'
    currentPainZh =
      '你现在最难受的，是外界希望你赶快明确、赶快表态，但你心里其实还没真正落稳。'
  } else if (input.weak) {
    pressureDetail =
      `A repeating strain for you shows up around ${flowMeaning(input.weak)}. It tends to flare when life asks for more of that function than you can comfortably sustain.`
    pressureDetailZh =
      `你的反复消耗点，通常落在${flowMeaningZh(input.weak)}这一面。只要现实要求你长期多扛这部分，人就容易感觉累。`
    pushRule('current_pain', 'wenzeng-rule-formation-of-shi-001', '命盘偏弱点会在现实里反复变成主要耗损位置。')
    currentPainZh = `你现在最容易被拖累的，就是 ${flowMeaningZh(input.weak)} 这条线。`
  }

  if (input.dayStage === '病' || input.dayStage === '沐浴') {
    pressureDetail +=
      ' You are more environment-sensitive than most people realize; the wrong room can flatten you fast, and the right room can restore you just as quickly.'
    pressureDetailZh +=
      ' 而且你比别人更吃环境，对的环境能很快把你托起来，不对的环境也会很快把你耗下去。'
    pushRule('environment_pattern', 'wenzeng-rule-low-level-markers-001', `日柱长生落在「${input.dayStage}」，环境和结构质量会更直接地影响状态。`)
    currentPain += ' Environment quality is affecting you more directly than usual.'
    currentPainZh += ' 而且最近环境质量对你的影响，比你自己想像的还直接。'

    extraEnglishCandidates.push({
      kind: 'atmosphereLoad',
      category: 'environment_pattern',
      title: 'The line that explains why you get tired around the wrong people',
      body:
        'You may think you are simply “too sensitive,” but a lot of your fatigue is actually atmospheric load. The wrong people, wrong room, or wrong rhythm enters your body before your mind can explain it.',
    })
    extraChineseCandidates.push({
      kind: 'atmosphereLoad',
      category: 'environment_pattern',
      title: '这一句最容易说中你为什么会被“气场不对的人”耗到',
      body:
        '你有时会以为自己只是太敏感，但很多累并不是情绪凭空出现，而是周围人的状态、场子的气压、节奏的失衡先压到了你身上，大脑还没来得及解释，身体已经先觉得不对。',
    })
    pushRule('environment_pattern', 'wenzeng-rule-health-body-vs-yong-001', '日柱落病或沐浴时，环境负荷与承载状态更容易先反映到体感层面，而不是只停在情绪概念里。')
  }

  if (input.kongWang && input.kongWang.length > 0) {
    cautionDetail =
      'The first answer, first promise, or first emotional read is often not the final truth for you. You usually understand the real shape only after one more turn.'
    cautionDetailZh =
      '第一反应、第一句答复、第一轮反馈，对你来说经常不是最终答案。很多事要再转一圈，你才会看到真正的形状。'
    pushRule('verification_pattern', 'wenzeng-rule-ke-priority-and-order-001', '空亡强调顺序和先后层级，第一信号不能直接当最终结论。')
    mostVerifiable =
      'One of the easiest things to verify soon is that the first answer, first promise, or first emotional read will not be the final one.'
    mostVerifiableZh =
      '你最近最容易马上验证的一点，就是第一句答复、第一轮反馈，往往都不是最终版本。'

    extraEnglishCandidates.push({
      kind: 'delayedTruthPattern',
      category: 'verification_pattern',
      title: 'The line that explains your repeated “second round” pattern',
      body:
        'A strange but repeatable pattern in your life is that the first version often looks real enough to trust, and only the second round reveals what was actually true.',
    })
    extraChineseCandidates.push({
      kind: 'delayedTruthPattern',
      category: 'verification_pattern',
      title: '这一句最容易说中你反复出现的“第二轮见真章”',
      body:
        '你的人生里很容易反复出现一种情况：第一版看起来已经够像答案了，真正的答案却总是在第二轮、第二次、或再拖一下之后才露出来。',
    })
  }

  if (input.dayRelation === 'stressful') {
    cautionDetail +=
      ' This is especially true in the next short window: reacting too fast is more dangerous than waiting one more beat.'
    cautionDetailZh +=
      ' 尤其在最近这一小段时间里，太快定论比多等一下更容易出错。'
  }

  if (input.weak === 'fire' && input.strong === 'metal') {
    extraEnglishCandidates.push({
      kind: 'visibilityCost',
      category: 'career_pressure',
      title: 'The line that explains why being visible costs you more than people assume',
      body:
        'People may think you are fully ready because you look composed. The truth is that visibility, exposure, and fast public reaction often cost you more energy than they can see.',
    })
    extraChineseCandidates.push({
      kind: 'visibilityCost',
      category: 'career_pressure',
      title: '这一句最容易说中你为什么“看起来稳，其实很耗”',
      body:
        '别人容易以为你看起来稳，就代表你不费力；但对你来说，曝光、表态、被看见、被催着马上回应，往往比外界看到的更耗电。',
    })
    pushRule('career_pressure', 'wenzeng-rule-career-structure-break-loss-001', '金强火弱时，公开表达、快速曝光和持续对外反应会更容易形成职业与能量上的结构性消耗。')
  }

  if (input.day === 'water' && (input.dayStage === '养' || input.dayStage === '胎')) {
    extraEnglishCandidates.push({
      kind: 'slowGrowth',
      category: 'life_path_pattern',
      title: 'The line that explains your “late ripening” pattern',
      body:
        'A lot of your better outcomes are not immediate. What suits you tends to become clearer after enough time, enough containment, and one more stage of growth.',
    })
    extraChineseCandidates.push({
      kind: 'slowGrowth',
      category: 'life_path_pattern',
      title: '这一句最容易说中你“后劲型”的命',
      body:
        '你真正适合的东西，往往不是一下子就很亮眼，而是要多养一段、多沉一下、多长一层，后面才会越来越像自己的路。',
    })
    pushRule('life_path_pattern', 'wenzeng-rule-fortune-cycle-reading-001', '偏水且长生阶段偏养胎时，更适合按阶段背景和后劲展开来读，不适合只按眼前一时下结论。')
  }

  if (input.strong === 'earth' || input.dayStem === '戊' || input.dayStem === '己') {
    extraEnglishCandidates.push({
      kind: 'familyRole',
      category: 'family_role',
      title: 'The line that explains the role people quietly put on you',
      body:
        'One hidden burden in your life is that people often treat you as the one who can absorb more, hold more, or stay steady longer than everyone else.',
    })
    extraChineseCandidates.push({
      kind: 'familyRole',
      category: 'family_role',
      title: '这一句最容易说中别人偷偷放在你身上的角色',
      body:
        '你的人生里有一种不太容易被直接说出来的负担，就是别人很容易默认你能多扛一点、多稳一点、多包一点，于是很多原本不该全由你接住的东西，也会慢慢落到你身上。',
    })
    pushRule('family_role', 'wenzeng-rule-parent-star-location-001', '土重或戊己日主时，更容易在家庭与关系结构里承担承接者、稳住场面的人设位置。')
  }

  if (input.day === 'metal' || input.dayStem === '辛' || input.dayStem === '庚') {
    extraEnglishCandidates.push({
      kind: 'silentCutoff',
      category: 'personality_contrast',
      title: 'The line that explains why you suddenly go cold after seeming patient',
      body:
        'A pattern around you is that patience can last a surprisingly long time, but once your internal standard is fully crossed, the cutoff is much faster and cleaner than people expect.',
    })
    extraChineseCandidates.push({
      kind: 'silentCutoff',
      category: 'personality_contrast',
      title: '这一句最容易说中你为什么会“突然冷掉”',
      body:
        '你并不是没有耐心，很多时候甚至会比别人忍得更久；但一旦心里的那条线真的被越过去，收口会比别人想像得更快、更干净，也更难回头。',
    })
    pushRule('personality_contrast', 'wenzeng-rule-special-patterns-001', '庚辛或金性明显时，很多“平时能忍、过线就断”的表现，常常更适合按特殊决断模式来理解。')
  }

  const deepEnglish = [
    {
      kind: 'mostLikePerson',
      category: 'personality_contrast',
      title: 'The line that feels uncomfortably accurate about you',
      body: `${mostLikePerson} ${edgeDetail}`,
    },
    {
      kind: 'currentPain',
      category: 'current_pain',
      title: 'The line most likely to hit the sore spot right now',
      body: `${currentPain} ${pressureDetail}`,
    },
    {
      kind: 'mostVerifiable',
      category: 'verification_pattern',
      title: 'The line reality is most likely to prove soon',
      body: `${mostVerifiable} ${cautionDetail}`,
    },
    ...extraEnglishCandidates,
  ]

  const deepChinese = [
    {
      kind: 'mostLikePerson',
      category: 'personality_contrast',
      title: '这一句最容易让人觉得“怎么会这么像”',
      body: `${mostLikePersonZh} ${edgeDetailZh}`,
    },
    {
      kind: 'currentPain',
      category: 'current_pain',
      title: '这一句最容易戳中你现在真正难受的地方',
      body: `${currentPainZh} ${pressureDetailZh}`,
    },
    {
      kind: 'mostVerifiable',
      category: 'verification_pattern',
      title: '这一句最容易在最近几天被现实验证',
      body: `${mostVerifiableZh} ${cautionDetailZh}`,
    },
    ...extraChineseCandidates,
  ]

  return {
    english: { edgeDetail, pressureDetail, cautionDetail },
    chinese: { edgeDetail: edgeDetailZh, pressureDetail: pressureDetailZh, cautionDetail: cautionDetailZh },
    ranking: {
      mostLikePerson: mostLikePersonZh,
      currentPain: currentPainZh,
      mostVerifiable: mostVerifiableZh,
    },
    deepCandidates: {
      english: deepEnglish,
      chinese: deepChinese,
    },
    ruleHits,
    rulePools,
  }
}

function selectDailyDeepCandidate(
  english: DeepCandidate[],
  chinese: DeepCandidate[],
  dailyVariant: number,
  seed: number,
  audienceWeights: Record<string, number>,
) {
  const categoryCycle = [
    ['personality_contrast', 'relationship_pattern', 'life_path_pattern'],
    ['current_pain', 'career_pressure', 'family_role', 'environment_pattern'],
    ['verification_pattern', 'environment_pattern', 'relationship_pattern'],
  ]

  const preferredCategories = categoryCycle[dailyVariant] ?? categoryCycle[0]
  const allCandidates = english.map((candidate, index) => ({
    candidate,
    chinese: chinese[index],
    index,
    score: (audienceWeights[candidate.category] ?? 0) + (preferredCategories.includes(candidate.category) ? 3 : 0),
  }))

  const topScore = Math.max(...allCandidates.map((item) => item.score))
  const topCandidates = allCandidates.filter((item) => item.score === topScore)
  if (topCandidates.length > 0 && topScore > 0) {
    const pick = topCandidates[seed % topCandidates.length]
    return {
      english: pick.candidate,
      chinese: pick.chinese,
      preferredCategory: pick.candidate.category,
      selectedIndex: pick.index,
    }
  }

  const preferredCategory = preferredCategories[seed % preferredCategories.length]
  const matching = allCandidates.filter((item) => item.candidate.category === preferredCategory)
  if (matching.length > 0) {
    const pick = matching[seed % matching.length]
    return {
      english: pick.candidate,
      chinese: pick.chinese,
      preferredCategory,
      selectedIndex: pick.index,
    }
  }

  const fallbackIndex = seed % english.length
  return {
    english: english[fallbackIndex],
    chinese: chinese[fallbackIndex],
    preferredCategory,
    selectedIndex: fallbackIndex,
  }
}

function relationToFlow(
  flowElement: NormalizedElement,
  favorable: NormalizedElement,
  unfavorable: NormalizedElement,
) {
  if (flowElement && favorable && flowElement === favorable) return 'supportive'
  if (flowElement && unfavorable && flowElement === unfavorable) return 'stressful'
  return 'neutral'
}

function rankedElements(chart: StoredChart | null) {
  const counts = chart?.analysis?.fiveElements ?? {}
  return (['wood', 'fire', 'earth', 'metal', 'water'] as const)
    .map((key) => ({
      element: key,
      count: typeof counts[key] === 'number' ? counts[key] : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

function topMarkers(chart: StoredChart | null) {
  const raw = chart?.analysis?.shenSha?.chartLevel ?? []
  const chartLevel = raw
    .map((value) => cleanString(value))
    .filter((value): value is string => Boolean(value))

  const picks: string[] = []
  if (chartLevel.some((value) => value.includes('文昌贵人'))) picks.push('learning and expression stand out strongly')
  if (chartLevel.some((value) => value.includes('驿马'))) picks.push('movement, travel, or environment shifts matter more than usual')
  if (chartLevel.some((value) => value.includes('华盖'))) picks.push('you carry a more inward, private, or self-contained thinking style')
  if (chartLevel.some((value) => value.includes('魁罡'))) picks.push('your will can become unusually forceful once you decide')
  if (chartLevel.some((value) => value.includes('天乙贵人'))) picks.push('help tends to appear when the timing is right')
  if (chartLevel.some((value) => value.includes('桃花'))) picks.push('relational magnetism is part of your pattern')
  return picks.slice(0, 2)
}

function buildResolvedLocation(chart: StoredChart | null) {
  const timing = chart?.analysis?.timing
  const dayStem = cleanString(chart?.analysis?.dayMaster?.stem)
  const timezone = cleanString(timing?.timezone)
  const location = timing?.location
  const latitude = typeof location?.latitude === 'number' ? location.latitude : null
  const longitude = typeof location?.longitude === 'number' ? location.longitude : null

  if (!dayStem || !timezone || latitude == null || longitude == null) {
    return null
  }

  return {
    dayStem,
    location: {
      queryKey: '',
      normalizedName: cleanString(location?.normalizedName) ?? 'Saved birth place',
      country: cleanString(location?.country),
      region: cleanString(location?.region),
      latitude,
      longitude,
      timezone,
      source: location?.source ?? 'input',
    } satisfies ResolvedLocation,
  }
}

function normalizeGender(value: string | null | undefined) {
  const text = cleanString(value)?.toLowerCase()
  if (!text) return null
  if (['female', 'woman', 'girl', 'f'].includes(text)) return 'female'
  if (['male', 'man', 'boy', 'm'].includes(text)) return 'male'
  return text
}

function buildAudienceSignals(profile: StoredProfile | null, chart: StoredChart | null) {
  const gender = normalizeGender(profile?.gender)
  const ageBand = cleanString(profile?.age_band)
  const language = cleanString(profile?.language)?.toLowerCase()
  const country = cleanString(chart?.analysis?.timing?.location?.country)?.toLowerCase()
  const westernCountries = new Set([
    'usa',
    'united states',
    'canada',
    'united kingdom',
    'uk',
    'ireland',
    'australia',
    'new zealand',
    'germany',
    'france',
    'spain',
    'italy',
    'netherlands',
    'sweden',
    'norway',
    'denmark',
    'finland',
    'belgium',
    'austria',
    'switzerland',
    'portugal',
  ])
  const isWesternAudience = language === 'en' || (country != null && westernCountries.has(country))
  const categoryWeights: Record<string, number> = {}
  const notes: string[] = []

  const bump = (category: string, amount: number, note?: string) => {
    categoryWeights[category] = (categoryWeights[category] ?? 0) + amount
    if (note) notes.push(note)
  }

  if (ageBand === '18_24') {
    bump('life_path_pattern', 2, '18-24 岁更容易被方向感、归属感和“我到底适合什么”牵动。')
    bump('relationship_pattern', 1)
  } else if (ageBand === '25_34') {
    bump('career_pressure', 2, '25-34 岁更容易关注职业方向、稳定性和是否走在正确轨道上。')
    bump('relationship_pattern', 2, '25-34 岁也更容易把关系清晰度和承诺问题当成真实压力源。')
    bump('current_pain', 1)
  } else if (ageBand === '35_44') {
    bump('family_role', 2, '35-44 岁更容易对家庭角色、责任分配和长期压力敏感。')
    bump('career_pressure', 1)
    bump('environment_pattern', 1)
  } else if (ageBand === '45_54') {
    bump('family_role', 2)
    bump('life_path_pattern', 1)
    bump('environment_pattern', 1)
  } else if (ageBand === '55_plus') {
    bump('life_path_pattern', 2)
    bump('family_role', 1)
    bump('verification_pattern', 1)
  }

  if (gender === 'female' && isWesternAudience && ageBand === '25_34') {
    bump('relationship_pattern', 1, '英语女性 25-34 岁常更敏感于关系清晰度、边界感和情绪劳动是否失衡。')
    bump('career_pressure', 1, '这一人群也更容易对职业可见度、自我怀疑和长期节奏是否可持续产生焦虑。')
    bump('environment_pattern', 1, '长期边界不清和持续性耗损，对这一人群也更容易直接压到体感。')
  }

  if (gender === 'female' && ageBand === '35_44') {
    bump('family_role', 1, '35-44 岁女性更容易在关系与家庭系统里承担额外情绪和协调责任。')
  }

  return {
    gender,
    ageBand,
    isWesternAudience,
    categoryWeights,
    notes,
  }
}

function chartSource(chart: StoredChart | null) {
  return cleanString(chart?.analysis?.source ?? chart?.source)
}

function chartNotes(chart: StoredChart | null) {
  const raw = chart?.analysis?.notes ?? []
  return raw
    .map((value) => cleanString(value))
    .filter((value): value is string => Boolean(value))
}

function firstImpressionFieldIssues(chart: StoredChart | null) {
  const issues: string[] = []
  if (!chart?.chart_text) issues.push('missing_chart_text')
  if (!chart?.pillars?.year || !chart?.pillars?.month || !chart?.pillars?.day || !chart?.pillars?.hour) {
    issues.push('missing_pillars')
  }
  if (!cleanString(chart?.analysis?.dayMaster?.stem)) issues.push('missing_day_master_stem')
  if (!normalizeElement(chart?.analysis?.dayMaster?.element)) issues.push('missing_day_master_element')
  if (!chart?.analysis?.fiveElements || Object.keys(chart.analysis.fiveElements).length == 0) {
    issues.push('missing_five_elements')
  }
  if (!cleanString(chart?.analysis?.twelveLifeStages?.day)) issues.push('missing_day_life_stage')
  if (!cleanString(chart?.analysis?.kongWang?.display)) issues.push('missing_kong_wang')

  const timing = chart?.analysis?.timing
  const location = timing?.location
  if (!cleanString(timing?.timezone)) issues.push('missing_timing_timezone')
  if (!cleanString(location?.normalizedName)) issues.push('missing_timing_location_name')
  if (typeof location?.latitude !== 'number' || typeof location?.longitude !== 'number') {
    issues.push('missing_timing_location_coordinates')
  }

  return Array.from(new Set(issues))
}

function buildBlockedResult(
  state: FirstImpressionState,
  issues: string[],
  renderSource: string,
  debug: Record<string, unknown>,
) {
  const block: FirstImpressionBlock = state === 'needs_profile_rebuild'
    ? {
        title: 'Your profile needs one quick update',
        body:
          'We need you to confirm your birth details one more time before we can complete your first reading and generate your three opening insights.',
        ctaLabel: 'Refresh your profile',
        ctaRoute: '/onboarding?mode=rebuild',
      }
    : {
        title: 'We’re preparing your reading',
        body:
          'Your profile is being prepared for its first full reading. Once the chart is ready, your opening insights will appear here automatically.',
        ctaLabel: 'Complete your profile',
        ctaRoute: '/onboarding',
      }

  return {
    ready: false,
    state,
    issues,
    renderSource,
    block,
    debug,
  }
}

export function computeFirstImpression(
  profile: StoredProfile | null,
  chart: StoredChart | null,
  now: DateTime = DateTime.utc(),
) {
  const issues = firstImpressionFieldIssues(chart)
  const notes = chartNotes(chart)
  const source = chartSource(chart)
  const legacyFallback = source === 'fallback' || notes.some((value) => value.includes('fallback_chart_generated'))
  const chartExists = chart != null
  const profileExists = profile != null

  if (!chartExists) {
    return buildBlockedResult(
      'preparing_profile',
      ['missing_chart_record'],
      'preparing_profile',
      {
        profileExists,
        chartExists,
        chartSource: source,
        notes,
      },
    )
  }

  if (legacyFallback) {
    return buildBlockedResult(
      'needs_profile_rebuild',
      Array.from(new Set([...issues, 'legacy_fallback_chart'])),
      'legacy_fallback_blocked',
      {
        profileExists,
        chartExists,
        chartSource: source,
        notes,
      },
    )
  }

  const resolved = buildResolvedLocation(chart)
  if (!resolved) {
    issues.push('missing_timing_location_context')
  }

  if (issues.length > 0) {
    return buildBlockedResult(
      'needs_profile_rebuild',
      Array.from(new Set(issues)),
      'blocked_incomplete_chart',
      {
        profileExists,
        chartExists,
        chartSource: source,
        notes,
      },
    )
  }

  const strong = normalizeElement(chart?.analysis?.strongElement)
  const weak = normalizeElement(chart?.analysis?.weakElement)
  const day = normalizeElement(chart?.analysis?.dayMaster?.element)
  const favorable = normalizeElement(chart?.analysis?.favorableElement)
  const unfavorable = normalizeElement(chart?.analysis?.unfavorableElement)
  const dayStem = cleanString(chart?.analysis?.dayMaster?.stem)
  const dayStage = cleanString(chart?.analysis?.twelveLifeStages?.day)
  const kongWang = cleanString(chart?.analysis?.kongWang?.display)
  const markers = topMarkers(chart)
  const ranked = rankedElements(chart)

  const flow = calculateCurrentFlowAtInstant(now, resolved.location, resolved.dayStem)
  const localNow = now.setZone(resolved.location.timezone)
  const dailyVariant = localNow.ordinal % 3
  const monthRelation = relationToFlow(flow.liuYue.element, favorable, unfavorable)
  const dayRelation = relationToFlow(flow.liuRi.element, favorable, unfavorable)
  const stageLine = dayStage ? (lifeStageMeaning[dayStage] ?? '') : ''
  const knowledgeSignals = buildKnowledgeSignals({
    day,
    strong,
    weak,
    dayStem,
    dayStage,
    kongWang,
    monthRelation,
    dayRelation,
  })
  const audienceSignals = buildAudienceSignals(profile, chart)
  const deepCandidateCount = knowledgeSignals.deepCandidates.english.length
  const deepSeed = (
    localNow.ordinal +
    localNow.day +
    localNow.month +
    (localNow.year % 10) +
    (dayStem?.codePointAt(0) ?? 0)
  ) % deepCandidateCount
  const deepSelection = selectDailyDeepCandidate(
    knowledgeSignals.deepCandidates.english,
    knowledgeSignals.deepCandidates.chinese,
    dailyVariant,
    deepSeed,
    audienceSignals.categoryWeights,
  )
  const deepCandidateIndex = deepSelection.selectedIndex
  const selectedRulePool = knowledgeSignals.rulePools[deepSelection.preferredCategory] ?? []

  const headline =
    strong === 'metal'
      ? 'You do best when things finally start to feel clear again.'
      : strong === 'water'
          ? 'You do best when your timing and instinct are working together.'
          : strong === 'earth'
              ? 'You feel strongest when life has some structure and something solid to stand on.'
              : strong === 'fire'
                  ? 'You build momentum fast when belief and action line up for you.'
                  : strong === 'wood'
                      ? 'You do best when something real is starting to grow in front of you.'
                      : 'You do best when your energy has one clear direction instead of being pulled in too many places at once.'

  const theme = monthRelation === 'supportive'
    ? `Right now the overall rhythm is helping you move toward ${flowMeaning(flow.liuYue.element)}. So this is less about forcing a result, and more about making the cleanest next move.`
    : monthRelation === 'stressful'
        ? 'Right now life is pressing on a part of you that is a little more sensitive. So pacing, clarity, and a bit of restraint will help you more than speed.'
        : 'Right now the overall rhythm feels mixed. Some things are opening, but timing and clear priorities still matter more than rushing.'

  const dailyDeepEnglish = deepSelection.english
  const dailyDeepChinese = deepSelection.chinese

  const top3Insights = [
    {
      eyebrow: 'What others notice first',
      title: 'General',
      body: [
        day === 'metal'
          ? 'You’re good at spotting what feels off. You usually notice what is weak, unclear, or inefficient before other people do.'
          : day === 'water'
              ? 'You’re good at reading timing. You can usually tell when to wait, when to pivot, and when something is starting to shift.'
              : day === 'earth'
                  ? 'Your strength is steadiness. People tend to feel that you can hold pressure, bring order back, and stay grounded when things get messy.'
                  : day === 'fire'
                      ? 'Your strength is momentum. When you believe in something, you can bring energy, visibility, and movement pretty quickly.'
                      : 'Your strength is growth. You do best when a direction feels genuinely alive and worth building.',
        knowledgeSignals.english.edgeDetail,
        markers.length > 0 ? `People may also notice that ${markers.join(' and ')}.` : '',
      ].filter((part) => part.trim().length > 0).join(' '),
    },
    {
      eyebrow: 'What is taking more energy than it should',
      title: 'More Over',
      body: weak == null
        ? 'Right now the tension looks more like split energy. Too many active threads can make it hard to feel clear.'
        : [
            `Right now, the pressure is mostly around ${flowMeaning(weak)}.`,
            monthRelation === 'stressful'
              ? 'What feels heavy right now is real, but it does not automatically mean you are on the wrong path. It is more that this period is pressing on an area that already asks more from you.'
              : monthRelation === 'supportive'
                  ? 'The outside conditions are helping more than hurting, which means the discomfort is probably more about what you are carrying inside than about a permanent block around you.'
                  : 'What makes this confusing is that one part of life is asking for movement while another part is asking for rest, so the tension can feel mixed instead of obvious.',
            knowledgeSignals.english.pressureDetail,
            stageLine,
          ].filter((part) => part.trim().length > 0).join(' '),
    },
    {
      ...dailyDeepEnglish,
      title: 'What matters now',
      body: dailyDeepEnglish.body
        .replace('The present strain is being pushed to move faster than your internal timing agrees with.', 'The hard part right now is that life seems to be pushing you faster than your own timing feels comfortable with.')
        .replace('One of the easiest things to verify soon is that the first answer, first promise, or first emotional read will not be the final one.', 'One thing you’ll probably notice pretty quickly is that the first answer, promise, or emotional read is not the final one.')
        .replace('You are often already reading the room while other people still think nothing has happened yet.', 'You’re often already reading the room while other people still think nothing has really changed yet.'),
    },
  ]

  const reviewDraft = {
    headline:
      strong === 'metal'
        ? '你最适合在局面逐渐清楚、边界逐渐分明的时候发力。'
        : strong === 'water'
            ? '你更适合凭时机感和直觉去判断什么时候该进、什么时候该停。'
            : strong === 'earth'
                ? '你真正的优势，往往出现在局面需要稳定、整理和托住的时候。'
                : strong === 'fire'
                    ? '你一旦认定方向，推动事情往前走的能力会很明显。'
                    : strong === 'wood'
                        ? '你更适合在一件事真正有成长空间时投入，不适合空耗。'
                        : '你的力量更适合在方向明确之后集中使用，而不是分散消耗。',
    theme:
      monthRelation === 'supportive'
        ? `当前流月对命盘偏支持，重心更适合顺着 ${flowMeaningZh(flow.liuYue.element)} 这一面推进，关键不是猛冲，而是顺势选更干净的一步。`
        : monthRelation === 'stressful'
            ? `当前流月压到命盘较敏感的一侧，主线更需要节制、顺序和边界，而不是只看速度。`
            : `当前流月对命盘影响偏混合，局面不是完全不开，但更考验时机判断和轻重缓急。`,
    top3Insights: [
      {
        eyebrow: '命盘优势',
        title: '别人通常最容易先感受到你什么',
        body: [
          `最像本人的一句是：${knowledgeSignals.ranking.mostLikePerson}`,
          day
            ? `命盘主调偏${elementChinese[day]}，说明你的天然优势更容易落在${flowMeaningZh(day)}这一面。`
            : '',
          dayStem ? (stemStyleChinese[dayStem] ?? '') : '',
          knowledgeSignals.chinese.edgeDetail,
          markers.length > 0 ? `命盘级标记还显示：${markers.join('；')}。` : '',
        ].filter((part) => part.trim().length > 0).join(' '),
      },
      {
        eyebrow: '当前压力',
        title: '这段时间最容易卡住你的点',
        body: [
          `当前最痛的一句是：${knowledgeSignals.ranking.currentPain}`,
          weak ? `命盘偏弱点落在${elementChinese[weak]}，现实里更容易表现为 ${flowMeaningZh(weak)} 相关问题反复消耗你。` : '',
          monthRelation === 'stressful'
            ? '流月又刚好压到这部分，所以这段时间的不顺不一定是方向错了，更多是你正在被迫面对一个本来就更费力的课题。'
            : monthRelation === 'supportive'
                ? '流月对你并非纯压制，所以现在的不舒服，更多像内部调整和节奏不匹配，而不是完全外部受阻。'
                : '现在的难点不是单一坏消息，而是推进和停顿同时出现，容易让人判断失焦。'
          ,
          knowledgeSignals.chinese.pressureDetail,
          dayStage ? `日柱长生落在「${dayStage}」，对应的提示是：${lifeStageMeaningChinese[dayStage] ?? ''}` : '',
        ].filter((part) => part.trim().length > 0).join(' '),
      },
      {
        ...dailyDeepChinese,
        body: [
          dailyDeepChinese.body,
          audienceSignals.notes.length > 0
            ? `为什么这位用户今天更容易被这类内容击中：${audienceSignals.notes.join('；')}`
            : '',
        ].filter((part) => part.trim().length > 0).join(' '),
      },
    ],
    reasoning: {
      dayMaster: dayStem,
      dayElement: day ? elementChinese[day] : '',
      strongElement: strong ? elementChinese[strong] : '',
      weakElement: weak ? elementChinese[weak] : '',
      favorableElement: favorable ? elementChinese[favorable] : '',
      unfavorableElement: unfavorable ? elementChinese[unfavorable] : '',
      dayStage,
      kongWang,
      liuNian: flow.liuNian.pillar,
      liuYue: flow.liuYue.pillar,
      liuRi: flow.liuRi.pillar,
      monthRelation,
      dayRelation,
      markers,
      ranking: knowledgeSignals.ranking,
      audienceSignals,
      dailyVariant,
      preferredDeepCategory: deepSelection.preferredCategory,
      deepCandidateIndex,
      deepCandidateCount,
      selectedDeepKind: dailyDeepChinese.kind,
      selectedRulePool,
      dailyDeepTitle: dailyDeepChinese.title,
      knowledgeHits: knowledgeSignals.ruleHits,
    },
  }

  return {
    ready: true,
    state: 'verified_ready' as const,
    issues,
    renderSource: 'first_impression',
    response: {
      headline,
      theme,
      top3Insights,
      nextBestMove:
        'Ask the one question that feels most urgent right now, then stay in the same thread if you want to go deeper without overspending coins.',
      currentFlow: {
        liuNian: flow.liuNian.pillar,
        liuYue: flow.liuYue.pillar,
        liuRi: flow.liuRi.pillar,
      },
    },
    debug: {
      profileExists,
      chartExists,
      chartSource: source,
      notes,
      resolvedLocation: resolved.location,
      flow,
      derivedFactors: {
        strongElement: strong,
        weakElement: weak,
        dayElement: day,
        favorableElement: favorable,
        unfavorableElement: unfavorable,
        dayStem,
        dayStemStyle: dayStem ? (stemStyle[dayStem] ?? '') : '',
        dayStage,
        dayStageMeaning: dayStage ? (lifeStageMeaning[dayStage] ?? '') : '',
        kongWang,
        markers,
        rankedElements: ranked,
        monthRelation,
        dayRelation,
        ranking: knowledgeSignals.ranking,
        audienceSignals,
        dailyVariant,
        preferredDeepCategory: deepSelection.preferredCategory,
        deepCandidateIndex,
        deepCandidateCount,
        selectedDeepKind: dailyDeepChinese.kind,
        selectedRulePool,
        knowledgeHits: knowledgeSignals.ruleHits,
      },
      reviewDraft,
    },
  }
}

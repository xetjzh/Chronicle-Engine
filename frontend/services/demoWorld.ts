import { ProjectData } from '../types';

export const initialProject: ProjectData = {
  id: 'proj_chronicle_001',
  title: '云渊异客录：边陲冷雨',
  genre: '东方低魔架空·悬疑生活群像',
  authorNote: '以寒江郡黑石城为舞台，探索战后边关流民、暗线司使与江湖游医的命运交织。',
  worldName: '大渊天朝·北关寒境',
  currentSimulationTime: '天元七年·霜降第十二日 戌时',
  timeStepIndex: 12,
  
  settings: {
    povPreference: '第三人称有限视角',
    literaryStyle: '古朴古典',
    chapterLengthTarget: 4000,
  },

  deskSettings: {
    targetDailyWords: 6000,
    currentSessionWords: 820,
    isZenMode: false,
    typewriterMode: true,
    indentParagraphs: true,
    theme: 'ink',
    fontSize: 18,
    lineHeight: 1.9,
    fontFamily: 'serif',
    soundEnabled: true,
  },

  referenceDocs: [
    {
      id: 'doc_ref_sample',
      fileName: '《北关郡志·异草草木考》摘录.txt',
      format: 'txt',
      title: '北关郡志·异草草木考',
      category: 'history',
      tags: ['地理物产', '边关医道', '黑市贸易'],
      sizeBytes: 12800,
      parsedChapters: [
        {
          id: 'ref_ch_1',
          title: '卷三：地脉青溟草与寒毒论',
          content: `【旧志所载】：
寒江以北，地冻三尺。每岁冬至，地脉隐透青芒，常有游医称见霜花结于草叶，触之如针芒刺骨，此青溟之气凝华也。
凡中此寒者，面皮惨白，口鼻生霜，脉沉细欲绝。寻常人参附子温药皆不能救，反激其寒性，唯取陈年雄黄三钱，文火慢煎入雄黄油，抹于膻中与人中二穴，温汤急灌，方有一线生机。
市井多传私贾自冰渊偷运碎晶，售价比金玉，然司隶府严勘，私藏一两即发配苦役三年。`,
        },
        {
          id: 'ref_ch_2',
          title: '卷七：黑石城夜巡与更夫旧制',
          content: `黑石城设巡夜都司，下辖更夫六十人。每夜亥正，两更交替，更夫必执铜锣竹梆，巡查各坊防火烛盗匪。
凡见紧闭门扉透出异光、或闻有磨铁私凿之声者，许直报南城大营铁卫，赏银五钱。近十年边衅渐起，屡有更夫夜巡失踪，骸骨抛于冻河之下，死状皆口鼻结冰。`,
        },
      ],
      excerpts: [
        {
          id: 'exc_001',
          docId: 'doc_ref_sample',
          docTitle: '北关郡志·异草草木考',
          chapterTitle: '卷三：地脉青溟草与寒毒论',
          selectedText: '唯取陈年雄黄三钱，文火慢煎入雄黄油，抹于膻中与人中二穴，温汤急灌，方有一线生机。',
          userNote: '裴子期随身银针包解毒时的核心配方与手法，用于第三幕抢救冻伤更夫时展开细腻描写。',
          tags: ['解毒医理', '裴子期技能'],
          createdAt: '2025-05-01 09:15:00',
        },
        {
          id: 'exc_002',
          docId: 'doc_ref_sample',
          docTitle: '北关郡志·异草草木考',
          chapterTitle: '卷七：黑石城夜巡与更夫旧制',
          selectedText: '近十年边衅渐起，屡有更夫夜巡失踪，骸骨抛于冻河之下，死状皆口鼻结冰。',
          userNote: '罗无忌今夜追查命案的真实历史渊源，说明城内早已有走私网暗害官差的先例。',
          tags: ['悬疑主线', '罗无忌动机'],
          createdAt: '2025-05-01 09:20:00',
        }
      ],
      importedAt: '2025-05-01 08:30:00',
    },
    {
      id: 'doc_ref_sample_2',
      fileName: '《古今兵备考·北狄夜刀》.txt',
      format: 'txt',
      title: '古今兵备考·北狄夜刀',
      category: 'worldbuilding',
      tags: ['兵刃武备', '边军建制'],
      sizeBytes: 8400,
      parsedChapters: [
        {
          id: 'ref_ch_2_1',
          title: '卷二：雁翎刀吞口与血槽工制',
          content: `都巡检司铁卫所用之墨铁雁翎刀，长三尺二寸，背厚刃薄，刀首微扬如雁翎。吞口多铸狻猊形，口衔环佩，夜行时以棉裹鞘，防金属碰撞发声。
刀身覆玄漆，遇夜不反月华，极利夜战潜行破甲。`,
        }
      ],
      excerpts: [
        {
          id: 'exc_003',
          docId: 'doc_ref_sample_2',
          docTitle: '古今兵备考·北狄夜刀',
          chapterTitle: '卷二：雁翎刀吞口与血槽工制',
          selectedText: '夜行时以棉裹鞘，防金属碰撞发声。刀身覆玄漆，遇夜不反月华。',
          userNote: '罗无忌步入客栈时腰刀无杂音的专业武官细节。',
          tags: ['兵甲细节'],
          createdAt: '2025-05-01 10:05:00',
        }
      ],
      importedAt: '2025-05-01 09:00:00',
    }
  ],

  aiConfig: {
    activeProvider: 'gemini',
    activePreset: 'sillytavern_literary',
    sampling: {
      temperature: 0.8,
      topP: 0.92,
      topK: 40,
      repetitionPenalty: 1.15,
      frequencyPenalty: 0.25,
      presencePenalty: 0.2,
      maxTokens: 3500,
      stopSequences: ['【未完待续】', '===END==='],
    },
    authorsNote: {
      enabled: true,
      content: '[作者附注：全篇严禁使用现代网络流行语；强化人物呼吸、眼神游移与衣袍水渍等冷雨夜细节；各人严守自身认知边界，不可提前预知他人的私人物品或暗中谋划]',
      insertionDepth: 1,
    },
    gemini: {
      model: 'gemini-2.5-flash',
      thinkingBudget: 0,
    },
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5:7b-instruct-q4_K_M',
      contextLength: 8192,
      keepAlive: '5m',
    },
    openaiCompatible: {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
    },
  },

  lorebook: [
    {
      id: 'lore_1',
      name: '青溟石 (地脉寒晶)',
      keys: ['青溟石', '异晶', '奇寒', '冻草', '霜晶'],
      content: '北关深层冻土特产的淡青色矿石。遇明火挥发无色清气，使周围气温瞬降百步结霜。接触者骨髓剧痛、面泛青斑。唯有陈年雄黄油与硫磺明火相克。黑市称其为「冰髓」，官署列为甲等禁运辎重。',
      isConstant: false,
      enabled: true,
      insertionOrder: 10,
      scanDepth: 1000,
      comment: '核心悬疑道具'
    },
    {
      id: 'lore_2',
      name: '黑石城宵禁与三司铁卫',
      keys: ['宵禁', '巡夜', '铁卫', '巡检司', '路引', '水牢'],
      content: '每入亥时，黑石城四座铁门下钥悬重锁。都巡检司兵卒身穿墨铁皮甲，二人一组持雁翎刀与火铳巡街。无兵部加盖血印关文夜行者，先杖三十押入司署水牢候审，反抗者斩立决。',
      isConstant: false,
      enabled: true,
      insertionOrder: 20,
      scanDepth: 1000,
      comment: '社会强力规则'
    },
    {
      id: 'lore_3',
      name: '听雨居客栈与严家暗账',
      keys: ['听雨居', '严素娘', '黄酒', '算盘', '后厨'],
      content: '客栈建于前朝开元年间，后壁暗嵌夹层密道直通鬼市暗渠。严素娘表面精明敛财，实为商号北境耳目，柜台红木算盘的第三根档子内藏有密信细铜管。',
      isConstant: true,
      enabled: true,
      insertionOrder: 5,
      scanDepth: 1000,
      comment: '主场景背景常驻'
    }
  ],

  rules: [
    {
      id: 'rule_1',
      category: 'natural',
      rule: '北境每逢寒潮，夜间城门下钥后宵禁严苛，擅登长街者视同夜谍。',
      consequenceOfViolation: '被巡夜羽林卫拘捕盘查，关押黑石司水牢。'
    },
    {
      id: 'rule_2',
      category: 'magic',
      rule: '地脉异晶「青溟石」遇明火会挥发无色清气，使方圆百步内燃草成霜，唯有陈年雄黄油可抑其寒气。',
      consequenceOfViolation: '草木冻碎，吸入者肺腑结霜。'
    },
    {
      id: 'rule_3',
      category: 'social',
      rule: '凡边关买卖医书或异邦违禁药材，需持三司红印关文，私售重罪。',
      consequenceOfViolation: '抄没家私，流放冰渊苦役三年。'
    }
  ],

  locations: [
    {
      id: 'loc_tavern',
      name: '听雨居客栈',
      type: 'tavern',
      description: '城南旧街破败客栈，梁柱熏黑，老炭炉旁围聚着走卒与避雨游子。',
      connectedLocationIds: ['loc_market', 'loc_gate'],
      climateOrDanger: '冷雨淅沥，屋内炉火微温'
    },
    {
      id: 'loc_market',
      name: '黑石里鬼市',
      type: 'market',
      description: '三教九流聚集之所，深巷无灯，暗桩以瓦罐火折传递暗语。',
      connectedLocationIds: ['loc_tavern', 'loc_dungeon'],
      climateOrDanger: '阴暗泥泞，暗哨密布'
    },
    {
      id: 'loc_gate',
      name: '寒江关北门',
      type: 'city',
      description: '以巨型玄石铸就的城关防线，重兵把守，旌旗在冻雨中猎猎作响。',
      connectedLocationIds: ['loc_tavern', 'loc_wilderness'],
      climateOrDanger: '风如刀割，严查通关路引'
    },
    {
      id: 'loc_wilderness',
      name: '乱石枯林',
      type: 'wilderness',
      description: '出关十里荒岗，常有雪狼盘踞与走私货郎潜行。',
      connectedLocationIds: ['loc_gate'],
      climateOrDanger: '暴雪将至，极寒易迷路'
    },
    {
      id: 'loc_dungeon',
      name: '司隶府旧密库',
      type: 'dungeon',
      description: '废弃五十年的官署地窖，积水过踝，藏着战乱年间未焚毁的户籍密册。',
      connectedLocationIds: ['loc_market'],
      climateOrDanger: '潮湿霉烂，毒虫暗藏'
    }
  ],

  factions: [
    {
      id: 'fac_guards',
      name: '寒江都巡检司',
      ideology: '戒严戍边，缉拿异端与私商',
      powerLevel: 85,
      allies: [],
      enemies: ['fac_smugglers']
    },
    {
      id: 'fac_smugglers',
      name: '九瓣青莲商号',
      ideology: '暗运药石与关外紧俏辎重，求财谋存',
      powerLevel: 60,
      allies: [],
      enemies: ['fac_guards']
    },
    {
      id: 'fac_common',
      name: '黑石城贫民坊',
      ideology: '熬过寒冬，但求温饱度日',
      powerLevel: 30,
      allies: [],
      enemies: []
    }
  ],

  characters: [
    {
      id: 'char_pei',
      name: '裴子期',
      title: '落魄游医',
      age: 32,
      gender: '男',
      factionId: 'fac_common',
      currentLocationId: 'loc_tavern',
      occupation: '江湖郎中 / 寻药隐士',
      appearance: '身形清瘦，青布长衫多有补丁，双手微凉带草药香，眼神沉静内敛。',
      personality: '寡言悲悯，慎思笃行，对世态冷暖洞若观火。',
      coreDesire: '寻回失散师妹临终所托的《寒原百草经》，并设法避开官府眼线。',
      greatestFear: '被都巡检司认出其曾经的罪籍太医身份。',
      currentMood: '警惕',
      moralityAlignment: '中立善',
      health: 82,
      wealth: 18,
      inventory: ['油布银针包', '半吊铜钱', '残缺的青瓷药碾', '风寒散三包'],
      currentGoal: '在客栈避雨，暗中向客商打听鬼市是否有异草出现',
      isAlive: true,
      relationships: {
        'char_luo': '怀疑',
        'char_yan': '旧识'
      },
      knownFacts: [
        {
          id: 'fact_p1',
          fact: '鬼市最近流通一批带泥的奇寒碎石，疑似青溟矿残渣。',
          learnedAtTime: '天元七年·霜降第十日',
          confidence: 0.9
        }
      ]
    },
    {
      id: 'char_luo',
      name: '罗无忌',
      title: '巡夜铁卫什长',
      age: 28,
      gender: '男',
      factionId: 'fac_guards',
      currentLocationId: 'loc_tavern',
      occupation: '都巡检司武吏',
      appearance: '腰悬墨铁雁翎刀，身披玄皮轻甲，面颊有一道旧冻伤疤痕，目光如鹰隼。',
      personality: '刚直执拗，恪尽职守，骨子里厌恶官场倾轧。',
      coreDesire: '查清城内私通关外的真正幕后黑手，洗清昔日恩师冤名。',
      greatestFear: '因轻信暗线而陷全队弟兄于死地。',
      currentMood: '疲惫',
      moralityAlignment: '守序中立',
      health: 95,
      wealth: 65,
      inventory: ['巡夜腰牌', '精铁佩刀', '金疮止血散', '半壶烈酒'],
      currentGoal: '进店避雨歇脚，暗察客栈里滞留的陌生行商与落脚客',
      isAlive: true,
      relationships: {
        'char_pei': '怀疑',
        'char_yan': '戒备'
      },
      knownFacts: [
        {
          id: 'fact_l1',
          fact: '城西三名更夫昨夜暴毙，口鼻带霜，兵部严令三日破案。',
          learnedAtTime: '天元七年·霜降第十一日',
          confidence: 1.0
        }
      ]
    },
    {
      id: 'char_yan',
      name: '严素娘',
      title: '听雨居掌柜',
      age: 36,
      gender: '女',
      factionId: 'fac_smugglers',
      currentLocationId: 'loc_tavern',
      occupation: '客栈老板娘 / 暗桩耳目',
      appearance: '挽妇人髻，身穿水红绣梅夹袄，眼角含笑，算盘拨弄间神采八面玲珑。',
      personality: '深谙人情世故，见风使舵却心存底线，极重义气。',
      coreDesire: '攒够赎契银子，带伙计在开春前迁往温暖的江南。',
      greatestFear: '商号暗账被官差搜出，客栈老幼遭连坐。',
      currentMood: '平静',
      moralityAlignment: '混乱中立',
      health: 88,
      wealth: 320,
      inventory: ['黄铜算盘', '账簿暗册', '藏在柜底的精钢袖箭', '清甜温黄酒'],
      currentGoal: '应付巡检司官差，掩护今夜鬼市交易暗号不出岔子',
      isAlive: true,
      relationships: {
        'char_pei': '照顾',
        'char_luo': '虚与委蛇'
      },
      knownFacts: [
        {
          id: 'fact_y1',
          fact: '罗无忌今夜带队巡街，但司里二把手并不信任他。',
          learnedAtTime: '天元七年·霜降第十二日',
          confidence: 0.85
        }
      ]
    },
    {
      id: 'char_he',
      name: '何老蔫',
      title: '拾荒盲叟',
      age: 61,
      gender: '男',
      factionId: 'fac_common',
      currentLocationId: 'loc_market',
      occupation: '打更夫 / 拾荒老人',
      appearance: '褴褛百纳袄，右眼蒙灰布，背驮如弓，手里常拄一截带铜铃的老竹杖。',
      personality: '唯唯诺诺，胆小怯弱，但耳朵比猎犬还要灵敏数倍。',
      coreDesire: '安稳过冬，不让冻伤的脚趾烂掉。',
      greatestFear: '被两方交手的刀剑波及。',
      currentMood: '焦虑',
      moralityAlignment: '绝对中立',
      health: 60,
      wealth: 4,
      inventory: ['竹杖铜铃', '破麻袋', '生锈铁钳', '半个杂粮饼'],
      currentGoal: '在鬼市地沟翻找弃置铜铁，无意间听到了密谋',
      isAlive: true,
      relationships: {},
      knownFacts: [
        {
          id: 'fact_h1',
          fact: '鬼市深处的水洼结了厚冰，有人在暗渠藏了个沉重铜箱。',
          learnedAtTime: '天元七年·霜降第十二日 酉时',
          confidence: 0.95
        }
      ]
    }
  ],

  events: [
    {
      id: 'evt_001',
      simulationTime: '天元七年·霜降第十日 申时',
      timeStepIndex: 10,
      eventType: 'discovery',
      locationId: 'loc_wilderness',
      participantIds: ['char_pei'],
      causeEventIds: [],
      title: '枯林惊现冻草奇状',
      description: '裴子期在出城采药归途中，目睹三株枯艾草凌空化作霜晶粉末，怀疑有人走私青溟石。',
      consequences: ['裴子期获知青溟石异动传闻', '决定留守客栈探查消息'],
      stateChanges: [],
      visibility: {
        isPublic: false,
        knownByCharacterIds: ['char_pei']
      },
      confirmed: true
    },
    {
      id: 'evt_002',
      simulationTime: '天元七年·霜降第十一日 子时',
      timeStepIndex: 11,
      eventType: 'conflict',
      locationId: 'loc_market',
      participantIds: ['char_luo'],
      causeEventIds: ['evt_001'],
      title: '巡夜卫发现更夫尸首',
      description: '更夫巡街暴毙于暗巷，罗无忌带队勘验，发现尸身骨髓冻脆，现场遗留商号暗记。',
      consequences: ['全城戒备升为丙级', '罗无忌加紧沿街客栈盘查'],
      stateChanges: [],
      visibility: {
        isPublic: true,
        knownByCharacterIds: ['char_luo', 'char_yan']
      },
      confirmed: true
    },
    {
      id: 'evt_003',
      simulationTime: '天元七年·霜降第十二日 戌时',
      timeStepIndex: 12,
      eventType: 'encounter',
      locationId: 'loc_tavern',
      participantIds: ['char_pei', 'char_luo', 'char_yan'],
      causeEventIds: ['evt_002'],
      title: '听雨居冷雨夜照面',
      description: '暴雨倾盆，罗无忌携刀推门而入，抖落雨水。堂内只有烤火的裴子期与算账的严素娘，气氛骤凝。',
      consequences: ['罗无忌对裴子期药囊起疑', '严素娘暗中移开账册'],
      stateChanges: [],
      visibility: {
        isPublic: false,
        knownByCharacterIds: ['char_pei', 'char_luo', 'char_yan']
      },
      confirmed: true
    }
  ],

  chapters: [
    {
      id: 'chap_001',
      volumeNumber: 1,
      chapterNumber: 1,
      title: '第一章 寒江带雨湿铁衣',
      povCharacterId: 'char_pei',
      outline: '雨夜荒客栈，落魄医者对坐炉火，官差突然登门，风雨欲来。',
      content: `戌时的更鼓被城南的冻雨泡得发闷，隔着两重湿漉漉的青黑瓦檐，传进听雨居客栈时只剩断断续续的沉响。

客栈里的老炭炉正吐着暗红的信子，烟道有些漏气，泛起一股干柴与枯艾混合的呛人气味。裴子期把双手悬在炉盖上三寸处，指节被湿冷蚀得微红。他的青布长衫下摆还沾着城外泥泞的干痕，身旁长凳上横放着一只褪了色的鹿皮药囊。

“客官，姜汤温着呢，再添一角？”

柜台后的严素娘头也没抬，纤细的手指在酸枝木算盘上拨得噼啪作响。她颈间裹着水红色的兔毛围领，油灯照得她眼角那一颗小痣格外生动。

裴子期微微摇头，声音低得像落在炭灰里的落叶：“多谢掌柜的。在下囊中羞涩，借这炉火烘干鞋袜便好。”

严素娘轻笑一声，算盘声忽地停了半拍。她斜睨了那药囊一眼，慢条斯理地压低嗓音：“外头雨大，黑石城今夜不平整。先生若是寻常行医的，亥时前还是早些歇下为妙。昨夜西渠边上……死得不干净。”

话音未落，厚重的棉布门帘猛地被带风掀开！

一道冷冽刺骨的水汽卷着刀风撞了进来，门槛上的粗铜铃铛发出一声短促的悲鸣。门外立着一道魁梧的身影，玄色皮甲上嵌着的墨铁叶子淌着冰水，腰间佩刀的吞口咬得极紧。

罗无忌抬手抹去脸颊旧伤上的雨水，鹰一般的目光在冷清的堂内扫了一圈，最终在烤火的裴子期手上停了足足两息。

“店家，”罗无忌大步迈入，靴底踩在油腻的木板上吱呀作响，“巡夜检勘。炉边那位，路引何在？”`,
      wordCount: 820,
      associatedEventIds: ['evt_003'],
      createdAt: '2025-05-01 10:00:00',
      updatedAt: '2025-05-01 10:00:00',
      status: 'final'
    }
  ],

  foreshadowing: [
    {
      id: 'fore_01',
      title: '更夫冻尸与青溟残矿的流向',
      plantedChapterId: 'chap_001',
      plantedTime: '天元七年·霜降第十一日',
      relatedCharacterIds: ['char_pei', 'char_luo', 'char_he'],
      expectedResolution: '在鬼市地下密库交锋时水落石出',
      isResolved: false,
      notes: '严素娘可能在此案中扮演了无意销赃的中介人角色。'
    }
  ],

  snapshots: [
    {
      id: 'snap_init',
      snapshotName: '初始开局：冷雨夜逢客栈',
      simulationTime: '天元七年·霜降第十二日 戌时',
      timeStepIndex: 12,
      createdAt: '2025-05-01 09:30:00',
      characters: [],
      eventsCount: 3,
      description: '三位主要角色在听雨居产生第一次因果交汇时的世界基准线。'
    }
  ]
};

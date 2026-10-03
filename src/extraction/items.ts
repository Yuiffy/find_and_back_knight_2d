export type ItemId = 'scrap' | 'electronics' | 'medicine' | 'sample' | 'core' | 'gold'
  | 'dq_pistachio' | 'beef_jerky' | 'sicily_lemon' | 'rtx_3050' | 'rtx_5070ti' | 'cpu_9800x3d'
  | 'cat_food' | 'cat_litter' | 'swim_pass' | 'gym_pass' | 'sichuan_hotpot' | 'biscuit_note' | 'cpu_12400f' | 'tarnished_camera';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Record<Rarity, string> = {
  common: '普通', uncommon: '优质', rare: '稀有', epic: '珍贵', legendary: '传说',
};
export interface ItemDefinition {
  name: string; value: number; weight: number; color: string; label: string;
  width: number; height: number; rarity: Rarity; description: string;
  category?: 'food' | 'hardware' | 'pet' | 'life' | 'memory';
  consume?: { label: string; hp: number; stamina: number };
}
export const ITEMS: Record<ItemId, ItemDefinition> = {
  scrap: { name: '工业合金', value: 90, weight: 1.8, color: '#a4b3b0', label: 'MAT',
    width: 2, height: 1, rarity: 'common', description: '耐蚀合金与替换零件。港区后勤按重量回收。' },
  electronics: { name: '精密电路', value: 240, weight: .8, color: '#69d8c1', label: 'TEC',
    width: 2, height: 2, rarity: 'uncommon', description: '封装完整的工业控制板。比废料轻，也更值钱。' },
  medicine: { name: '医用物资', value: 180, weight: .6, color: '#9bdbcd', label: 'MED',
    width: 1, height: 2, rarity: 'uncommon', description: '密封敷料与消毒用品。撤离后出售；行动治疗使用已装备的医疗包。' },
  sample: { name: '密封样本', value: 480, weight: 1.2, color: '#8babf4', label: 'LAB',
    width: 1, height: 2, rarity: 'rare', description: '冷藏运输筒中的港区样本。医疗站委托需要安全带回一份。' },
  core: { name: '归航信号核心', value: 1400, weight: 2.5, color: '#caa2f2', label: 'SIG',
    width: 2, height: 3, rarity: 'epic', description: '储存归航频段的雷达模块。占格较大，无法放入安全箱；请留出完整空间。' },
  gold: { name: '旧世纪念章', value: 650, weight: .4, color: '#e4bc75', label: 'VAL',
    width: 1, height: 1, rarity: 'legendary', description: '旧港区留下的镀金纪念章。体积小、价值高，适合放入安全箱。' },
  dq_pistachio: { name: 'DQ 开心果冰淇淋', value: 160, weight: .35, color: '#a9d7a3', label: 'DQ',
    width: 1, height: 2, rarity: 'uncommon', category: 'food', consume: { label: '吃一口冰淇淋', hp: 6, stamina: 45 },
    description: '开心果的绿，奶油的白。冷藏箱里这一杯，是熟悉的下播奖励。现场吃掉恢复 6 生命、45 体力，也可以完整带回。' },
  beef_jerky: { name: '风干牛肉干', value: 120, weight: .3, color: '#dba787', label: 'BEEF',
    width: 2, height: 1, rarity: 'common', category: 'food', consume: { label: '吃牛肉干', hp: 12, stamina: 20 },
    description: '口袋里压扁了一点，但仍是远征补给桌上的硬通货。熟悉的旧版零食；吃掉恢复 12 生命、20 体力，不能止血。' },
  sicily_lemon: { name: '西西里柠檬柚', value: 140, weight: .45, color: '#e2d287', label: 'CITRUS',
    width: 1, height: 2, rarity: 'uncommon', category: 'food', consume: { label: '喝柠檬柚', hp: 4, stamina: 60 },
    description: '柠檬和西柚的香气装在一瓶里，直播桌边熟悉的酸甜味。喝掉恢复 4 生命、60 体力；冲刺之后来一口。' },
  rtx_3050: { name: 'RTX 3050 显卡', value: 620, weight: .65, color: '#8eafe0', label: '3050',
    width: 2, height: 2, rarity: 'rare', category: 'hardware',
    description: '风扇还能转。旧版搜打撤里的老朋友，也许足够让饼干台恢复一次清晰直播。二手硬件仍有回收价值。' },
  rtx_5070ti: { name: 'RTX 5070 Ti 显卡', value: 2400, weight: 1.6, color: '#e4bc75', label: '5070 Ti',
    width: 3, height: 2, rarity: 'legendary', category: 'hardware',
    description: '三个风扇占了半张桌子。看见型号就想带回去的升级大件：价值高，但需要留出完整的 3×2 空间。' },
  cpu_9800x3d: { name: 'Ryzen 9800X3D', value: 1650, weight: .08, color: '#caa2f2', label: '9800X3D',
    width: 1, height: 1, rarity: 'epic', category: 'hardware',
    description: '小小一颗，装着下一台游戏电脑的期待。透明保护盒还没拆，体积小、价值高，值得先放进安全箱。' },
  cat_food: { name: '猫粮', value: 260, weight: 1.5, color: '#a9c8b1', label: 'CAT',
    width: 2, height: 2, rarity: 'uncommon', category: 'pet',
    description: '熟悉的猫咪头像和干粮袋。自己饿了可以忍，家里的猫饭可不能断。带回基地出售或留着当一份日常纪念。' },
  cat_litter: { name: '豆腐猫砂', value: 200, weight: 4, color: '#a4b3b0', label: 'LITTER',
    width: 2, height: 3, rarity: 'common', category: 'pet',
    description: '一大袋，真的很沉。养猫人的补货日常：占六格、重四公斤，拎回去之前先想想这趟背包够不够。' },
  swim_pass: { name: '游泳卡', value: 480, weight: .02, color: '#8babf4', label: 'SWIM',
    width: 1, height: 1, rarity: 'rare', category: 'life',
    description: '波纹图案磨得发亮，卡套里还夹着泳道号码。等这次平安回来，再去游一趟。小体积的生活收藏。' },
  gym_pass: { name: '健身卡', value: 520, weight: .02, color: '#caa2f2', label: 'GYM',
    width: 1, height: 1, rarity: 'epic', category: 'life',
    description: '熟悉的“明天一定去”。照片旁边写着会员编号，带回来当纪念也行，卖掉换下一轮补给也行。' },
  sichuan_hotpot: { name: '四川火锅底料', value: 180, weight: .45, color: '#dba787', label: 'HOT POT',
    width: 2, height: 1, rarity: 'uncommon', category: 'food',
    description: '旧版搜打撤里那袋熟悉的底料，辣度写着“岁己可以”。这是下播后的饭，现场不能直接吃。' },
  biscuit_note: { name: '饼干岁留言', value: 30, weight: .01, color: '#a9c8b1', label: 'SUI',
    width: 1, height: 1, rarity: 'uncommon', category: 'memory',
    description: '“收到请回答！以及不要舔洞里的蘑菇！”从旧版空洞一路留下来的便签，不值多少钱，却让人想带回去。' },
  cpu_12400f: { name: '12400F 处理器', value: 420, weight: .08, color: '#8eafe0', label: '12400F',
    width: 1, height: 1, rarity: 'rare', category: 'hardware',
    description: '盒角磨损，标签依然清楚。旧版机房里的老伙计；未必是最新配置，但还可以撑起一次开播。' },
  tarnished_camera: { name: '褪色拍立得', value: 700, weight: .5, color: '#8babf4', label: 'PHOTO',
    width: 2, height: 2, rarity: 'rare', category: 'memory',
    description: '旧版里那台仍能亮起闪光灯的相机。不是每一件带回来的东西，都得拿去换钱。' },
};

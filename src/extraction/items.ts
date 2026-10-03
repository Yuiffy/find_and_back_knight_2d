export type ItemId = 'scrap' | 'electronics' | 'medicine' | 'sample' | 'core' | 'gold';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Record<Rarity, string> = {
  common: '普通', uncommon: '优质', rare: '稀有', epic: '珍贵', legendary: '传说',
};
export interface ItemDefinition {
  name: string; value: number; weight: number; color: string; label: string;
  width: number; height: number; rarity: Rarity; description: string;
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
};

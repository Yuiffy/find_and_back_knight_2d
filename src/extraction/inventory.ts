import { ITEMS, type ItemId } from './items.ts';

export interface GridSize { columns: number; rows: number }
export interface ItemPlacement { x: number; y: number; rotated: boolean }
export interface GridInventory {
  grid: GridSize; items: ItemId[]; slots: ItemPlacement[]; known: boolean[]; single?: boolean;
}
export const bagGrid = (p: { packLevel: number }): GridSize => ({ columns: 5, rows: 4 + p.packLevel * 2 });
export const stashGrid = (p: { stashLevel: number }): GridSize => ({ columns: 8, rows: 6 + p.stashLevel * 4 });
export const SECURE_GRID: GridSize = { columns: 2, rows: 2 };
export const cellCapacity = (grid: GridSize) => grid.columns * grid.rows;
export const occupiedCells = (items: ItemId[]) => items.reduce((n, item) => n + ITEMS[item].width * ITEMS[item].height, 0);
export function itemSize(item: ItemId, rotated = false) {
  const d = ITEMS[item];
  return rotated ? { width: d.height, height: d.width } : { width: d.width, height: d.height };
}
export function fits(inventory: GridInventory, item: ItemId, slot: ItemPlacement, ignore = -1): boolean {
  if (!Number.isInteger(slot.x) || !Number.isInteger(slot.y) || typeof slot.rotated !== 'boolean') return false;
  const { width, height } = itemSize(item, slot.rotated);
  if (slot.x < 0 || slot.y < 0 || slot.x + width > inventory.grid.columns || slot.y + height > inventory.grid.rows) return false;
  return inventory.items.every((other, index) => {
    if (index === ignore) return true;
    const p = inventory.slots[index];
    if (!p) return false;
    const s = itemSize(other, p.rotated);
    return slot.x + width <= p.x || p.x + s.width <= slot.x || slot.y + height <= p.y || p.y + s.height <= slot.y;
  });
}
export function findSpace(inventory: GridInventory, item: ItemId, rotated = false): ItemPlacement | null {
  for (const orientation of [rotated, !rotated])
    for (let y = 0; y < inventory.grid.rows; y++)
      for (let x = 0; x < inventory.grid.columns; x++) {
        const slot = { x, y, rotated: orientation };
        if (fits(inventory, item, slot)) return slot;
      }
  return null;
}
export function emptyInventory(grid: GridSize, single = false): GridInventory {
  return { grid, items: [], slots: [], known: [], single };
}
export function normalizeInventory(items: ItemId[], grid: GridSize, preferred: unknown = []): { inventory: GridInventory; overflow: ItemId[] } {
  const inventory = emptyInventory(grid), positions = Array.isArray(preferred) ? preferred : [];
  const slots: (ItemPlacement | undefined)[] = Array(items.length);
  for (let i = 0; i < items.length; i++) {
    const p = positions[i] as ItemPlacement | undefined;
    if (p && fits(inventory, items[i], p)) {
      slots[i] = { x: p.x, y: p.y, rotated: p.rotated };
      inventory.items.push(items[i]); inventory.slots.push(slots[i]!); inventory.known.push(true);
    }
  }
  for (let i = 0; i < items.length; i++) {
    if (slots[i]) continue;
    const p = findSpace(inventory, items[i]);
    if (p) { slots[i] = p; inventory.items.push(items[i]); inventory.slots.push(p); inventory.known.push(true); }
  }
  const overflow: ItemId[] = [];
  inventory.items = []; inventory.slots = []; inventory.known = [];
  items.forEach((item, i) => {
    if (slots[i]) { inventory.items.push(item); inventory.slots.push(slots[i]!); inventory.known.push(true); }
    else overflow.push(item);
  });
  return { inventory, overflow };
}
export function arrange(inventory: GridInventory): GridInventory | null {
  const sorted = inventory.items.map((item, index) => ({ item, index }))
    .sort((a, b) => occupiedCells([b.item]) - occupiedCells([a.item]) || ITEMS[b.item].height - ITEMS[a.item].height || a.index - b.index);
  const free = cellCapacity(inventory.grid) - occupiedCells(inventory.items);
  // Leave a complete rectangle when possible, so sorting actually helps pick up
  // a large module instead of turning all spare cells into a thin last row.
  const reservations: (ItemId | null)[] = ['core', 'electronics', 'medicine', 'scrap', null];
  for (const reserve of reservations) {
    const packed = emptyInventory(inventory.grid, inventory.single), slots: ItemPlacement[] = Array(inventory.items.length);
    if (reserve) {
      if (occupiedCells([reserve]) > free) continue;
      const s = itemSize(reserve), p = { x: inventory.grid.columns - s.width, y: inventory.grid.rows - s.height, rotated: false };
      if (!fits(packed, reserve, p)) continue;
      packed.items.push(reserve); packed.slots.push(p); packed.known.push(false);
    }
    let success = true;
    for (const { item, index } of sorted) {
      const slot = findSpace(packed, item);
      if (!slot) { success = false; break; }
      slots[index] = slot; packed.items.push(item); packed.slots.push(slot); packed.known.push(true);
    }
    if (success) return { ...inventory, slots };
  }
  return null;
}
export function containerInventory(items: ItemId[], identified = false): GridInventory {
  for (let rows = 4; rows <= 120; rows++) {
    const { inventory, overflow } = normalizeInventory(items, { columns: 5, rows });
    if (!overflow.length) return { ...inventory, known: items.map(() => identified) };
  }
  throw new Error('容器物资过多');
}
function copy(inventory: GridInventory): GridInventory {
  return { ...inventory, items: [...inventory.items], slots: inventory.slots.map(p => ({ ...p })), known: [...inventory.known] };
}
/** Plan first, commit both inventories together. A rejected transfer changes neither side. */
export function planTransfer(source: GridInventory, index: number, target: GridInventory, placement?: ItemPlacement, rotated = false): { source: GridInventory; target: GridInventory } | null {
  if (!Number.isInteger(index) || index < 0 || !source.items[index] || !source.known[index]) return null;
  const item = source.items[index];
  if (source === target) {
    if (!placement || !fits(source, item, placement, index)) return null;
    const next = copy(source); next.slots[index] = { ...placement };
    return { source: next, target: next };
  }
  const from = copy(source), to = copy(target);
  from.items.splice(index, 1); from.slots.splice(index, 1); from.known.splice(index, 1);
  const previous = to.single ? to.items[0] : undefined;
  const previousRotation = to.slots[0]?.rotated ?? false;
  if (to.single) { to.items = []; to.slots = []; to.known = []; }
  const slot = placement ?? findSpace(to, item, rotated);
  if (!slot || !fits(to, item, slot)) return null;
  if (previous) {
    const back = findSpace(from, previous, previousRotation);
    if (!back) return null;
    from.items.push(previous); from.slots.push(back); from.known.push(true);
  }
  to.items.push(item); to.slots.push({ ...slot }); to.known.push(true);
  return { source: from, target: to };
}

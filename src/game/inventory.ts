import { ITEMS } from './items';
import type { GridItem, GridSize, ItemStack } from '../types/game';

let uidCounter = 0;

export function makeGridUid(itemId: string): string {
  uidCounter += 1;
  return `${itemId}-${Date.now().toString(36)}-${uidCounter.toString(36)}`;
}

export function cloneStacks(stacks: readonly ItemStack[]): ItemStack[] {
  return stacks.map((stack) => ({ ...stack }));
}

export function cloneGridItems(items: readonly GridItem[]): GridItem[] {
  return items.map((item) => ({ ...item }));
}

export function getGridItemSize(item: Pick<GridItem, 'itemId' | 'rotated'>): GridSize {
  const base = ITEMS[item.itemId]?.size ?? { width: 1, height: 1 };
  return item.rotated
    ? { width: base.height, height: base.width }
    : { ...base };
}

export function addItem(stacks: readonly ItemStack[], itemId: string, quantity = 1): ItemStack[] {
  const definition = ITEMS[itemId];
  if (!definition || quantity <= 0) return cloneStacks(stacks);

  const next = cloneStacks(stacks);
  let remaining = quantity;
  for (const stack of next) {
    if (stack.itemId !== itemId || stack.quantity >= definition.stackLimit) continue;
    const amount = Math.min(definition.stackLimit - stack.quantity, remaining);
    stack.quantity += amount;
    remaining -= amount;
  }
  while (remaining > 0) {
    const amount = Math.min(definition.stackLimit, remaining);
    next.push({ itemId, quantity: amount });
    remaining -= amount;
  }
  return next;
}

export function addStacks(stacks: readonly ItemStack[], additions: readonly ItemStack[]): ItemStack[] {
  return additions.reduce<ItemStack[]>(
    (current, stack) => addItem(current, stack.itemId, stack.quantity),
    cloneStacks(stacks),
  );
}

export function removeItem(stacks: readonly ItemStack[], itemId: string, quantity = 1): ItemStack[] | null {
  const available = stacks
    .filter((stack) => stack.itemId === itemId)
    .reduce((total, stack) => total + stack.quantity, 0);
  if (available < quantity) return null;

  let remaining = quantity;
  const next: ItemStack[] = [];
  for (const stack of stacks) {
    if (stack.itemId !== itemId || remaining === 0) {
      next.push({ ...stack });
      continue;
    }
    const amount = Math.min(stack.quantity, remaining);
    remaining -= amount;
    if (stack.quantity > amount) next.push({ ...stack, quantity: stack.quantity - amount });
  }
  return next;
}

function overlaps(a: GridItem, b: GridItem): boolean {
  const aSize = getGridItemSize(a);
  const bSize = getGridItemSize(b);
  return a.x < b.x + bSize.width
    && a.x + aSize.width > b.x
    && a.y < b.y + bSize.height
    && a.y + aSize.height > b.y;
}

export function canPlaceGridItem(
  items: readonly GridItem[],
  grid: GridSize,
  item: GridItem,
  x: number,
  y: number,
  ignoreUid = item.uid,
): boolean {
  if (!ITEMS[item.itemId]) return false;
  const size = getGridItemSize(item);
  if (x < 0 || y < 0 || x + size.width > grid.width || y + size.height > grid.height) {
    return false;
  }
  const candidate = { ...item, x, y };
  return !items.some((existing) => existing.uid !== ignoreUid && overlaps(candidate, existing));
}

export function rotateGridItem(
  items: readonly GridItem[],
  grid: GridSize,
  uid: string,
): GridItem[] | null {
  const item = items.find((entry) => entry.uid === uid);
  if (!item) return null;
  const definition = ITEMS[item.itemId];
  if (!definition || definition.size.width === definition.size.height) return cloneGridItems(items);
  const rotated = { ...item, rotated: !item.rotated };
  if (!canPlaceGridItem(items, grid, rotated, item.x, item.y, uid)) return null;
  return items.map((entry) => (entry.uid === uid ? rotated : { ...entry }));
}

function firstOpenPosition(items: readonly GridItem[], grid: GridSize, item: GridItem): { x: number; y: number } | null {
  const size = getGridItemSize(item);
  for (let y = 0; y <= grid.height - size.height; y += 1) {
    for (let x = 0; x <= grid.width - size.width; x += 1) {
      if (canPlaceGridItem(items, grid, item, x, y, '')) return { x, y };
    }
  }
  return null;
}

export interface SmartInsertResult {
  items: GridItem[];
  placedAt: { x: number; y: number } | null;
  merged: boolean;
  autoPlaced: boolean;
}

/** Inserts one existing instance transactionally: merge first, then preferred cell, then first fit. */
export function insertGridItemSmart(
  items: readonly GridItem[],
  grid: GridSize,
  item: GridItem,
  preferred?: { x: number; y: number },
): SmartInsertResult | null {
  const definition = ITEMS[item.itemId];
  if (!definition || item.quantity <= 0) return null;
  const next = cloneGridItems(items);
  let remaining = item.quantity;
  let merged = false;

  for (const existing of next) {
    if (existing.itemId !== item.itemId || existing.quantity >= definition.stackLimit) continue;
    const amount = Math.min(definition.stackLimit - existing.quantity, remaining);
    if (amount <= 0) continue;
    existing.quantity += amount;
    remaining -= amount;
    merged = true;
    if (remaining === 0) return { items: next, placedAt: null, merged, autoPlaced: false };
  }

  const candidate = { ...item, quantity: remaining };
  if (preferred && canPlaceGridItem(next, grid, candidate, preferred.x, preferred.y, '')) {
    return {
      items: [...next, { ...candidate, ...preferred }],
      placedAt: preferred,
      merged,
      autoPlaced: false,
    };
  }
  const position = firstOpenPosition(next, grid, candidate);
  if (!position) return null;
  return {
    items: [...next, { ...candidate, ...position }],
    placedAt: position,
    merged,
    autoPlaced: Boolean(preferred),
  };
}

export function moveOrMergeGridItem(
  items: readonly GridItem[],
  grid: GridSize,
  uid: string,
  x: number,
  y: number,
  rotated?: boolean,
): SmartInsertResult | null {
  const item = items.find((entry) => entry.uid === uid);
  if (!item) return null;
  const without = items.filter((entry) => entry.uid !== uid);
  const result = insertGridItemSmart(without, grid, { ...item, rotated: rotated ?? item.rotated }, { x, y });
  if (!result) return null;
  return result;
}

export interface PreciseGridPlacementResult {
  items: GridItem[];
  kind: 'placed' | 'merged' | 'swapped';
  /** Present when an external source replaces a backpack item. */
  displaced?: GridItem;
}

/**
 * Performs an intentional grid drop without the automatic first-fit fallback used
 * by quick pickup. A covered item may be swapped, or several smaller covered
 * items may collectively trade places with the moved item's old footprint.
 */
export function placeGridItemPrecisely(
  items: readonly GridItem[],
  grid: GridSize,
  candidate: GridItem,
  x: number,
  y: number,
  sourceUid?: string,
  sourcePosition?: { x: number; y: number },
): PreciseGridPlacementResult | null {
  const definition = ITEMS[candidate.itemId];
  if (!definition || candidate.quantity <= 0) return null;

  const source = sourceUid ? items.find((entry) => entry.uid === sourceUid) : undefined;
  const withoutSource = source
    ? items.filter((entry) => entry.uid !== source.uid).map((entry) => ({ ...entry }))
    : cloneGridItems(items);
  const positioned = { ...candidate, x, y };
  const covered = withoutSource.filter((entry) => overlaps(positioned, entry));

  if (covered.length === 0) {
    if (!canPlaceGridItem(withoutSource, grid, positioned, x, y, '')) return null;
    return { items: [...withoutSource, positioned], kind: 'placed' };
  }
  if (covered.length === 1 && covered[0].itemId === positioned.itemId) {
    const target = covered[0];
    if (target.quantity + positioned.quantity > definition.stackLimit) return null;
    return {
      items: withoutSource.map((entry) => entry.uid === target.uid
        ? { ...entry, quantity: entry.quantity + positioned.quantity }
        : entry),
      kind: 'merged',
    };
  }

  const withoutCovered = withoutSource.filter((entry) => !covered.some((target) => target.uid === entry.uid));
  if (!canPlaceGridItem(withoutCovered, grid, positioned, x, y, '')) return null;
  const next = [...withoutCovered, positioned];

  if (!source || !sourcePosition) {
    if (covered.length !== 1) return null;
    return { items: next, kind: 'swapped', displaced: { ...covered[0] } };
  }

  const sourceSize = getGridItemSize(source);
  const returned: GridItem[] = [];
  const returnCandidates = [...covered].sort((left, right) => {
    const leftSize = getGridItemSize(left);
    const rightSize = getGridItemSize(right);
    return rightSize.width * rightSize.height - leftSize.width * leftSize.height;
  });
  for (const target of returnCandidates) {
    const targetSize = getGridItemSize(target);
    let placement: { x: number; y: number } | null = null;
    for (let returnY = sourcePosition.y; returnY <= sourcePosition.y + sourceSize.height - targetSize.height && !placement; returnY += 1) {
      for (let returnX = sourcePosition.x; returnX <= sourcePosition.x + sourceSize.width - targetSize.width; returnX += 1) {
        const returnedItem = { ...target, x: returnX, y: returnY };
        if (canPlaceGridItem([...next, ...returned], grid, returnedItem, returnX, returnY, '')) {
          placement = { x: returnX, y: returnY };
          break;
        }
      }
    }
    if (!placement) return null;
    returned.push({ ...target, ...placement });
  }
  return { items: [...next, ...returned], kind: 'swapped' };
}

export function splitGridItem(
  items: readonly GridItem[],
  grid: GridSize,
  uid: string,
): GridItem[] | null {
  const source = items.find((entry) => entry.uid === uid);
  if (!source || source.quantity < 2) return null;
  const splitQuantity = Math.floor(source.quantity / 2);
  const next = items.map((entry) => entry.uid === uid
    ? { ...entry, quantity: entry.quantity - splitQuantity }
    : { ...entry });
  const candidate: GridItem = {
    ...source,
    uid: makeGridUid(source.itemId),
    quantity: splitQuantity,
    x: 0,
    y: 0,
  };
  const position = firstOpenPosition(next, grid, candidate);
  if (!position) return null;
  return [...next, { ...candidate, ...position }];
}

export function compactGridItems(items: readonly GridItem[], grid: GridSize): GridItem[] | null {
  const mergedStacks = gridItemsToStacks(items);
  const instances: GridItem[] = [];
  for (const stack of mergedStacks) {
    const definition = ITEMS[stack.itemId];
    let remaining = stack.quantity;
    while (remaining > 0) {
      const quantity = Math.min(definition.stackLimit, remaining);
      const original = items.find((item) => item.itemId === stack.itemId && !instances.some((entry) => entry.uid === item.uid));
      instances.push({
        uid: original?.uid ?? makeGridUid(stack.itemId),
        itemId: stack.itemId,
        quantity,
        x: 0,
        y: 0,
        rotated: original?.rotated ?? false,
      });
      remaining -= quantity;
    }
  }
  instances.sort((left, right) => {
    const leftSize = getGridItemSize(left);
    const rightSize = getGridItemSize(right);
    return (rightSize.width * rightSize.height) - (leftSize.width * leftSize.height);
  });

  let packed: GridItem[] = [];
  for (const instance of instances) {
    const orientations = ITEMS[instance.itemId].size.width === ITEMS[instance.itemId].size.height
      ? [instance]
      : [instance, { ...instance, rotated: !instance.rotated }];
    let placed: GridItem | null = null;
    for (const orientation of orientations) {
      const position = firstOpenPosition(packed, grid, orientation);
      if (position) {
        placed = { ...orientation, ...position };
        break;
      }
    }
    if (!placed) return null;
    packed = [...packed, placed];
  }
  return packed;
}

export function insertGridStack(
  items: readonly GridItem[],
  grid: GridSize,
  stack: ItemStack,
): GridItem[] | null {
  const definition = ITEMS[stack.itemId];
  if (!definition || stack.quantity <= 0) return cloneGridItems(items);
  const next = cloneGridItems(items);
  let remaining = stack.quantity;

  for (const existing of next) {
    if (existing.itemId !== stack.itemId || existing.quantity >= definition.stackLimit) continue;
    const amount = Math.min(definition.stackLimit - existing.quantity, remaining);
    existing.quantity += amount;
    remaining -= amount;
  }

  while (remaining > 0) {
    const candidate: GridItem = {
      uid: makeGridUid(stack.itemId),
      itemId: stack.itemId,
      quantity: Math.min(definition.stackLimit, remaining),
      x: 0,
      y: 0,
      rotated: false,
    };
    const position = firstOpenPosition(next, grid, candidate);
    if (!position) return null;
    next.push({ ...candidate, ...position });
    remaining -= candidate.quantity;
  }
  return next;
}

export function insertGridStacks(
  items: readonly GridItem[],
  grid: GridSize,
  stacks: readonly ItemStack[],
): GridItem[] | null {
  let next = cloneGridItems(items);
  for (const stack of stacks) {
    const inserted = insertGridStack(next, grid, stack);
    if (!inserted) return null;
    next = inserted;
  }
  return next;
}

export function removeGridQuantity(
  items: readonly GridItem[],
  itemId: string,
  quantity: number,
): GridItem[] | null {
  const total = items
    .filter((item) => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
  if (total < quantity) return null;
  let remaining = quantity;
  const next: GridItem[] = [];
  for (const item of items) {
    if (item.itemId !== itemId || remaining === 0) {
      next.push({ ...item });
      continue;
    }
    const removed = Math.min(item.quantity, remaining);
    remaining -= removed;
    if (item.quantity > removed) next.push({ ...item, quantity: item.quantity - removed });
  }
  return next;
}

export function gridItemsToStacks(items: readonly GridItem[]): ItemStack[] {
  return items.reduce<ItemStack[]>(
    (stacks, item) => addItem(stacks, item.itemId, item.quantity),
    [],
  );
}

export function occupiedGridCells(items: readonly GridItem[]): number {
  return items.reduce((total, item) => {
    const size = ITEMS[item.itemId] ? getGridItemSize(item) : null;
    return total + (size ? size.width * size.height : 0);
  }, 0);
}

export function validateGrid(items: readonly GridItem[], grid: GridSize): boolean {
  return items.every((item) => canPlaceGridItem(items, grid, item, item.x, item.y));
}

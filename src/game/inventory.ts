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
  const aSize = ITEMS[a.itemId].size;
  const bSize = ITEMS[b.itemId].size;
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
  const definition = ITEMS[item.itemId];
  if (!definition) return false;
  if (x < 0 || y < 0 || x + definition.size.width > grid.width || y + definition.size.height > grid.height) {
    return false;
  }
  const candidate = { ...item, x, y };
  return !items.some((existing) => existing.uid !== ignoreUid && overlaps(candidate, existing));
}

export function moveGridItem(
  items: readonly GridItem[],
  grid: GridSize,
  uid: string,
  x: number,
  y: number,
): GridItem[] | null {
  const item = items.find((entry) => entry.uid === uid);
  if (!item || !canPlaceGridItem(items, grid, item, x, y)) return null;
  return items.map((entry) => (entry.uid === uid ? { ...entry, x, y } : { ...entry }));
}

export function insertGridItemAt(
  items: readonly GridItem[],
  grid: GridSize,
  item: GridItem,
  x: number,
  y: number,
): GridItem[] | null {
  const candidate = { ...item, x, y };
  if (!canPlaceGridItem(items, grid, candidate, x, y, '')) return null;
  return [...cloneGridItems(items), candidate];
}

function firstOpenPosition(items: readonly GridItem[], grid: GridSize, item: GridItem): { x: number; y: number } | null {
  const size = ITEMS[item.itemId].size;
  for (let y = 0; y <= grid.height - size.height; y += 1) {
    for (let x = 0; x <= grid.width - size.width; x += 1) {
      if (canPlaceGridItem(items, grid, item, x, y, '')) return { x, y };
    }
  }
  return null;
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
    const size = ITEMS[item.itemId]?.size;
    return total + (size ? size.width * size.height : 0);
  }, 0);
}

export function validateGrid(items: readonly GridItem[], grid: GridSize): boolean {
  return items.every((item) => canPlaceGridItem(items, grid, item, item.x, item.y));
}

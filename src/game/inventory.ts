import { ITEMS } from './items';
import type { ItemStack } from '../types/game';

export function cloneStacks(stacks: ItemStack[]): ItemStack[] {
  return stacks.map((stack) => ({ ...stack }));
}

export function addItem(stacks: ItemStack[], itemId: string, quantity = 1): ItemStack[] {
  const definition = ITEMS[itemId];
  if (!definition || quantity <= 0) return cloneStacks(stacks);

  const next = cloneStacks(stacks);
  let remaining = quantity;

  for (const stack of next) {
    if (stack.itemId !== itemId || stack.quantity >= definition.stackLimit) continue;
    const room = definition.stackLimit - stack.quantity;
    const amount = Math.min(room, remaining);
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

export function addStacks(stacks: ItemStack[], additions: ItemStack[]): ItemStack[] {
  return additions.reduce(
    (current, stack) => addItem(current, stack.itemId, stack.quantity),
    cloneStacks(stacks),
  );
}

export function removeItem(stacks: ItemStack[], itemId: string, quantity = 1): ItemStack[] | null {
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
    if (stack.quantity > amount) {
      next.push({ ...stack, quantity: stack.quantity - amount });
    }
  }
  return next;
}

export function hasInventoryRoom(stacks: ItemStack[], capacity: number, itemId: string): boolean {
  const definition = ITEMS[itemId];
  if (!definition) return false;
  const existingHasRoom = stacks.some(
    (stack) => stack.itemId === itemId && stack.quantity < definition.stackLimit,
  );
  return existingHasRoom || stacks.length < capacity;
}

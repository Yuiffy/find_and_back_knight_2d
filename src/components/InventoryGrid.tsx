import type { DragEvent, MouseEvent } from 'react';
import { ITEMS, RARITY_NAMES } from '../game/items';
import type { GearSlot, GridItem, GridSize } from '../types/game';

export type InventorySource = 'warehouse' | 'backpack' | 'loadout';

export interface InventoryDragPayload {
  source: InventorySource;
  uid?: string;
  slot?: GearSlot;
}

interface InventoryGridProps {
  ariaLabel: string;
  items: GridItem[];
  size: GridSize;
  source: 'warehouse' | 'backpack';
  selected: InventoryDragPayload | null;
  onSelect: (payload: InventoryDragPayload | null) => void;
  onDropItem: (payload: InventoryDragPayload, x: number, y: number) => void;
}

const DRAG_TYPE = 'application/x-sui-grid-item';

export function writeInventoryDrag(event: DragEvent, payload: InventoryDragPayload): void {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
}

export function readInventoryDrag(event: DragEvent): InventoryDragPayload | null {
  const raw = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InventoryDragPayload;
  } catch {
    return null;
  }
}

export function InventoryGrid({
  ariaLabel,
  items,
  size,
  source,
  selected,
  onSelect,
  onDropItem,
}: InventoryGridProps) {
  function getCell(event: DragEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>): { x: number; y: number } {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(size.width - 1, Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * size.width))),
      y: Math.min(size.height - 1, Math.max(0, Math.floor(((event.clientY - bounds.top) / bounds.height) * size.height))),
    };
  }

  return (
    <div
      className={`inventory-grid inventory-grid-${source}`}
      role="grid"
      aria-label={ariaLabel}
      style={{
        gridTemplateColumns: `repeat(${size.width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size.height}, minmax(0, 1fr))`,
        aspectRatio: `${size.width} / ${size.height}`,
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const payload = readInventoryDrag(event);
        if (!payload) return;
        const cell = getCell(event);
        onDropItem(payload, cell.x, cell.y);
        onSelect(null);
      }}
      onClick={(event) => {
        if (!selected) return;
        const cell = getCell(event);
        onDropItem(selected, cell.x, cell.y);
        onSelect(null);
      }}
    >
      {Array.from({ length: size.width * size.height }).map((_, index) => (
        <span className="inventory-cell" role="gridcell" key={`${source}-cell-${index}`} />
      ))}
      {items.map((gridItem) => {
        const item = ITEMS[gridItem.itemId];
        const isSelected = selected?.source === source && selected.uid === gridItem.uid;
        return (
          <button
            className={`grid-item rarity-${item.rarity}${isSelected ? ' is-selected' : ''}`}
            style={{
              gridColumn: `${gridItem.x + 1} / span ${item.size.width}`,
              gridRow: `${gridItem.y + 1} / span ${item.size.height}`,
            }}
            key={gridItem.uid}
            type="button"
            draggable
            aria-pressed={isSelected}
            aria-label={`${item.name}，${item.size.width}乘${item.size.height}格，${RARITY_NAMES[item.rarity]}`}
            title={`${item.name} · ${item.size.width}×${item.size.height}\n${item.description}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(isSelected ? null : { source, uid: gridItem.uid });
            }}
            onDragStart={(event) => writeInventoryDrag(event, { source, uid: gridItem.uid })}
          >
            <span>{item.icon}</span>
            <strong>{item.name}</strong>
            <small>{item.size.width}×{item.size.height}</small>
            {gridItem.quantity > 1 && <b>×{gridItem.quantity}</b>}
          </button>
        );
      })}
    </div>
  );
}

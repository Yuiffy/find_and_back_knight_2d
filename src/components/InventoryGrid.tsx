import { useState, type DragEvent, type MouseEvent } from 'react';
import { ITEMS, RARITY_NAMES } from '../game/items';
import { getGridItemSize } from '../game/inventory';
import type { GearSlot, GridItem, GridSize } from '../types/game';

export type InventorySource = 'warehouse' | 'backpack' | 'loadout';

export interface InventoryDragPayload {
  source: InventorySource;
  uid?: string;
  slot?: GearSlot;
  itemId?: string;
  rotated?: boolean;
  grabOffsetX?: number;
  grabOffsetY?: number;
}

export function rotateInventoryDragPayload(payload: InventoryDragPayload): InventoryDragPayload {
  if (!payload.itemId) return payload;
  const item = ITEMS[payload.itemId];
  if (!item || item.size.width === item.size.height) return payload;

  const grabOffsetX = payload.grabOffsetX ?? 0;
  const grabOffsetY = payload.grabOffsetY ?? 0;
  return payload.rotated
    ? {
      ...payload,
      rotated: false,
      grabOffsetX: grabOffsetY,
      grabOffsetY: item.size.height - 1 - grabOffsetX,
    }
    : {
      ...payload,
      rotated: true,
      grabOffsetX: item.size.height - 1 - grabOffsetY,
      grabOffsetY: grabOffsetX,
    };
}

interface InventoryGridProps {
  ariaLabel: string;
  items: GridItem[];
  size: GridSize;
  source: 'warehouse' | 'backpack';
  selected: InventoryDragPayload | null;
  getActiveDrag: () => InventoryDragPayload | null;
  onSelect: (payload: InventoryDragPayload | null) => void;
  onDragStart: (payload: InventoryDragPayload) => void;
  onDragEnd: () => void;
  onDropItem: (payload: InventoryDragPayload, x: number, y: number) => void;
  onRotateItem: (payload: InventoryDragPayload) => void;
  onQuickTransfer: (payload: InventoryDragPayload) => void;
}

const DRAG_TYPE = 'application/x-sui-grid-item';

export function writeInventoryDrag(event: DragEvent, payload: InventoryDragPayload): void {
  event.dataTransfer.effectAllowed = 'move';
  const serialized = JSON.stringify(payload);
  event.dataTransfer.setData(DRAG_TYPE, serialized);
  event.dataTransfer.setData('text/plain', serialized);
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
  getActiveDrag,
  onSelect,
  onDragStart,
  onDragEnd,
  onDropItem,
  onRotateItem,
  onQuickTransfer,
}: InventoryGridProps) {
  const [preview, setPreview] = useState<null | { x: number; y: number; width: number; height: number; valid: boolean }>(null);

  function getCell(
    event: DragEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
    payload?: InventoryDragPayload | null,
  ): { x: number; y: number } {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - bounds.left) / bounds.width) * size.width) - (payload?.grabOffsetX ?? 0),
      y: Math.floor(((event.clientY - bounds.top) / bounds.height) * size.height) - (payload?.grabOffsetY ?? 0),
    };
  }

  function updatePreview(event: DragEvent<HTMLDivElement>): void {
    const payload = getActiveDrag() ?? readInventoryDrag(event);
    if (!payload?.itemId || !ITEMS[payload.itemId]) return;
    const anchor = getCell(event, payload);
    const footprint = getGridItemSize({ itemId: payload.itemId, rotated: payload.rotated });
    const inBounds = anchor.x >= 0 && anchor.y >= 0
      && anchor.x + footprint.width <= size.width
      && anchor.y + footprint.height <= size.height;
    const collides = items.some((item) => {
      if (payload.source === source && item.uid === payload.uid) return false;
      const itemSize = getGridItemSize(item);
      return anchor.x < item.x + itemSize.width
        && anchor.x + footprint.width > item.x
        && anchor.y < item.y + itemSize.height
        && anchor.y + footprint.height > item.y;
    });
    setPreview({ ...anchor, ...footprint, valid: inBounds && !collides });
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
        updatePreview(event);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const payload = getActiveDrag() ?? readInventoryDrag(event);
        if (!payload) return;
        const cell = getCell(event, payload);
        onDropItem(payload, cell.x, cell.y);
        onSelect(null);
        setPreview(null);
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
      {preview && (
        <span
          className={`inventory-drop-preview ${preview.valid ? 'is-valid' : 'is-auto'}`}
          style={{
            gridColumn: `${preview.x + 1} / span ${preview.width}`,
            gridRow: `${preview.y + 1} / span ${preview.height}`,
          }}
          aria-hidden="true"
        />
      )}
      {items.map((gridItem) => {
        const item = ITEMS[gridItem.itemId];
        const footprint = getGridItemSize(gridItem);
        const isSelected = selected?.source === source && selected.uid === gridItem.uid;
        const payload = { source, uid: gridItem.uid, itemId: gridItem.itemId, rotated: gridItem.rotated } as const;
        return (
          <button
            className={`grid-item rarity-${item.rarity}${isSelected ? ' is-selected' : ''}`}
            style={{
              gridColumn: `${gridItem.x + 1} / span ${footprint.width}`,
              gridRow: `${gridItem.y + 1} / span ${footprint.height}`,
            }}
            key={gridItem.uid}
            type="button"
            draggable
            aria-pressed={isSelected}
            aria-label={`${item.name}，${footprint.width}乘${footprint.height}格，${RARITY_NAMES[item.rarity]}`}
            title={`${item.name} · ${footprint.width}×${footprint.height}\n${item.description}\n右键或选中后按 R 旋转；双击快速转移`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(isSelected ? null : payload);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onQuickTransfer(payload);
              onSelect(null);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onRotateItem(payload);
            }}
            onDragStart={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const dragPayload = {
                ...payload,
                grabOffsetX: Math.min(footprint.width - 1, Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * footprint.width))),
                grabOffsetY: Math.min(footprint.height - 1, Math.max(0, Math.floor(((event.clientY - bounds.top) / bounds.height) * footprint.height))),
              };
              writeInventoryDrag(event, dragPayload);
              onDragStart(dragPayload);
            }}
            onDragEnd={onDragEnd}
          >
            <span>{item.icon}</span>
            <strong>{item.name}</strong>
            <small>{footprint.width}×{footprint.height}{gridItem.rotated ? ' ↻' : ''}</small>
            {gridItem.quantity > 1 && <b>×{gridItem.quantity}</b>}
          </button>
        );
      })}
    </div>
  );
}

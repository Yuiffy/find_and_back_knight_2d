import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
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
  pointerId?: number;
  pointerX?: number;
  pointerY?: number;
  dragStartX?: number;
  dragStartY?: number;
  dragMoved?: boolean;
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
  activeDrag: InventoryDragPayload | null;
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
  activeDrag,
  getActiveDrag,
  onSelect,
  onDragStart,
  onDragEnd,
  onDropItem,
  onRotateItem,
  onQuickTransfer,
}: InventoryGridProps) {
  const [preview, setPreview] = useState<null | { x: number; y: number; width: number; height: number; valid: boolean }>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  function getCellAtPoint(
    clientX: number,
    clientY: number,
    bounds: DOMRect,
    payload?: InventoryDragPayload | null,
  ): { x: number; y: number } {
    return {
      x: Math.floor(((clientX - bounds.left) / bounds.width) * size.width) - (payload?.grabOffsetX ?? 0),
      y: Math.floor(((clientY - bounds.top) / bounds.height) * size.height) - (payload?.grabOffsetY ?? 0),
    };
  }

  function updatePreview(payload: InventoryDragPayload): void {
    const bounds = gridRef.current?.getBoundingClientRect();
    if (!bounds || !payload.itemId || !ITEMS[payload.itemId] || !payload.dragMoved) {
      setPreview(null);
      return;
    }
    if (payload.pointerX == null || payload.pointerY == null
      || payload.pointerX < bounds.left || payload.pointerX >= bounds.right
      || payload.pointerY < bounds.top || payload.pointerY >= bounds.bottom) {
      setPreview(null);
      return;
    }
    const anchor = getCellAtPoint(payload.pointerX, payload.pointerY, bounds, payload);
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

  useEffect(() => {
    if (activeDrag) updatePreview(activeDrag);
    else setPreview(null);
  }, [activeDrag, items, size]);

  useEffect(() => {
    const handlePointerUp = (event: globalThis.PointerEvent) => {
      const payload = getActiveDrag();
      const bounds = gridRef.current?.getBoundingClientRect();
      if (!payload || !bounds || payload.pointerId !== event.pointerId) return;
      const isInside = event.clientX >= bounds.left && event.clientX < bounds.right
        && event.clientY >= bounds.top && event.clientY < bounds.bottom;
      if (!isInside) return;
      if (!payload.dragMoved) {
        if (payload.source === source) onSelect(payload);
      } else {
        const cell = getCellAtPoint(event.clientX, event.clientY, bounds, payload);
        onDropItem(payload, cell.x, cell.y);
        onSelect(null);
      }
      onDragEnd();
    };
    window.addEventListener('pointerup', handlePointerUp, true);
    return () => window.removeEventListener('pointerup', handlePointerUp, true);
  }, [getActiveDrag, onDragEnd, onDropItem, onSelect, source]);

  return (
    <div
      ref={gridRef}
      className={`inventory-grid inventory-grid-${source}`}
      role="grid"
      aria-label={ariaLabel}
      style={{
        gridTemplateColumns: `repeat(${size.width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size.height}, minmax(0, 1fr))`,
        aspectRatio: `${size.width} / ${size.height}`,
      }}
      onClick={(event) => {
        if (!selected) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const cell = getCellAtPoint(event.clientX, event.clientY, bounds);
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
            draggable={false}
            aria-pressed={isSelected}
            aria-label={`${item.name}，${footprint.width}乘${footprint.height}格，${RARITY_NAMES[item.rarity]}`}
            title={`${item.name} · ${footprint.width}×${footprint.height}\n${item.description}\n右键或选中后按 R 旋转；双击快速转移`}
            onClick={(event) => {
              event.stopPropagation();
              if (event.detail > 0) return;
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
            onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              const bounds = event.currentTarget.getBoundingClientRect();
              const dragPayload = {
                ...payload,
                grabOffsetX: Math.min(footprint.width - 1, Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * footprint.width))),
                grabOffsetY: Math.min(footprint.height - 1, Math.max(0, Math.floor(((event.clientY - bounds.top) / bounds.height) * footprint.height))),
                pointerId: event.pointerId,
                pointerX: event.clientX,
                pointerY: event.clientY,
                dragStartX: event.clientX,
                dragStartY: event.clientY,
                dragMoved: false,
              };
              onDragStart(dragPayload);
            }}
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

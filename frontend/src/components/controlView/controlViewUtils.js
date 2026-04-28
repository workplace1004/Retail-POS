const FUNCTION_BUTTON_SLOT_COUNT = 4;
const OPTION_BUTTON_SLOT_COUNT = 28;
const OPTION_BUTTON_LOCKED_ID = 'meer';
const DEFAULT_OPTION_BUTTON_LAYOUT = [
  'extra-bc-bedrag', '', 'bc-refund', 'stock-retour', 'product-labels', '', '',
  'ticket-afdrukken', '', 'tegoed', 'tickets-optellen', '', 'product-info', 'personeel-ticket',
  'productie-bericht', 'prijs-groep', 'discount', 'kadobon', 'various', 'plu', 'product-zoeken',
  'lade', 'klanten', 'historiek', 'subtotaal', 'terugname', '', 'meer'
];
const TABLE_TEMPLATE_OPTIONS = [
  { id: '4table', chairs: 4, width: 130, height: 155 },
  { id: '5table', chairs: 5, width: 145, height: 173 },
  { id: '6table', chairs: 6, width: 150, height: 179 }
];

/** Set tables modal: layout bounds match the fixed editor canvas (see ControlView chrome). */
export const SET_TABLES_LAYOUT_CANVAS_WIDTH = 979;
export const SET_TABLES_LAYOUT_CANVAS_HEIGHT = 614;

/** Parse x/y from layout JSON (supports left/top, posX/posY, comma decimals). */
export function parseLayoutCoord(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).trim().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Read table X for editor / canvas (canonical x plus legacy keys; skip null/empty so `left` still applies). */
export function layoutEditorReadTableX(table) {
  if (!table || typeof table !== 'object') return 0;
  for (const v of [table.x, table.left, table.posX, table.position?.x]) {
    if (v != null && v !== '') return parseLayoutCoord(v);
  }
  return 0;
}

/** Read table Y for editor / canvas (canonical y plus legacy keys). */
export function layoutEditorReadTableY(table) {
  if (!table || typeof table !== 'object') return 0;
  for (const v of [table.y, table.top, table.posY, table.position?.y]) {
    if (v != null && v !== '') return parseLayoutCoord(v);
  }
  return 0;
}

function hasExplicitTableX(table) {
  if (table == null || typeof table !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(table, 'x')) return true;
  if (Object.prototype.hasOwnProperty.call(table, 'left')) return true;
  if (Object.prototype.hasOwnProperty.call(table, 'posX')) return true;
  const pos = table.position;
  if (pos != null && typeof pos === 'object' && Object.prototype.hasOwnProperty.call(pos, 'x')) return true;
  return false;
}

function hasExplicitTableY(table) {
  if (table == null || typeof table !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(table, 'y')) return true;
  if (Object.prototype.hasOwnProperty.call(table, 'top')) return true;
  if (Object.prototype.hasOwnProperty.call(table, 'posY')) return true;
  const pos = table.position;
  if (pos != null && typeof pos === 'object' && Object.prototype.hasOwnProperty.call(pos, 'y')) return true;
  return false;
}

export function normalizeFunctionButtonSlots(value) {
  if (!Array.isArray(value)) return Array(FUNCTION_BUTTON_SLOT_COUNT).fill('');
  const next = Array(FUNCTION_BUTTON_SLOT_COUNT).fill('');
  const used = new Set();
  for (let i = 0; i < FUNCTION_BUTTON_SLOT_COUNT; i += 1) {
    const candidate = String(value[i] || '').trim();
    if (!candidate) continue;
    if (used.has(candidate)) continue;
    next[i] = candidate;
    used.add(candidate);
  }
  return next;
}

export function normalizeOptionButtonSlots(value) {
  if (!Array.isArray(value)) return [...DEFAULT_OPTION_BUTTON_LAYOUT];
  const next = Array(OPTION_BUTTON_SLOT_COUNT).fill('');
  const used = new Set();
  for (let i = 0; i < OPTION_BUTTON_SLOT_COUNT; i += 1) {
    const candidate = String(value[i] || '').trim();
    if (!candidate) continue;
    if (used.has(candidate)) continue;
    next[i] = candidate;
    used.add(candidate);
  }
  if (!next.includes(OPTION_BUTTON_LOCKED_ID)) {
    next[OPTION_BUTTON_SLOT_COUNT - 1] = OPTION_BUTTON_LOCKED_ID;
  }
  return next;
}

export function createDefaultBoard(_table, color = '#CA8A04') {
  return {
    id: `board-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    color,
    x: 100,
    y: 100,
    width: 30,
    height: 180,
    rotation: 0
  };
}

export function normalizeBoardToItem(b, defaultColor = '#CA8A04') {
  return {
  id: b?.id && typeof b.id === 'string' ? b.id : `board-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  color: typeof b?.color === 'string' && b.color.trim() ? b.color.trim() : defaultColor,
  x: parseLayoutCoord(b?.x ?? b?.left ?? b?.posX),
  y: parseLayoutCoord(b?.y ?? b?.top ?? b?.posY),
  width: Math.max(10, Number(b?.width) || 120),
  height: Math.max(10, Number(b?.height) || 120),
  rotation: Number(b?.rotation) || 0
  };
}

export function createDefaultFlowerPot() {
  return {
    id: `flowerpot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    x: 200,
    y: 200,
    width: 60,
    height: 72,
    rotation: 0
  };
}

export function normalizeFlowerPotToItem(fp) {
  return {
    id: fp?.id && typeof fp.id === 'string' ? fp.id : `flowerpot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    x: parseLayoutCoord(fp?.x ?? fp?.left ?? fp?.posX),
    y: parseLayoutCoord(fp?.y ?? fp?.top ?? fp?.posY),
    width: Math.max(10, Number(fp?.width) || 60),
    height: Math.max(10, Number(fp?.height) || 72),
    rotation: Number(fp?.rotation) || 0
  };
}

export function createDefaultLayoutTable(index = 1, templateType = '4table') {
  const tpl = TABLE_TEMPLATE_OPTIONS.find((item) => item.id === templateType) || TABLE_TEMPLATE_OPTIONS[0];
  return {
    id: `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `T-${String(index).padStart(2, '0')}`,
    x: 120 + (index - 1) * 180,
    y: 120 + ((index - 1) % 3) * 120,
    width: tpl.width, 
    height: tpl.height,
    chairs: tpl.chairs,
    rotation: 0,
    round: false,
    templateType: tpl.id,
    boards: [],
    flowerPots: []
  };
}

export function normalizeLayoutEditorDraft(raw, locationName = 'Restaurant') {
  const hasTablesArray = Array.isArray(raw?.tables);
  const tables = Array.isArray(raw?.tables)
    ? raw.tables.map((table, index) => {
        const xParsed = parseLayoutCoord(table?.x ?? table?.left ?? table?.posX ?? table?.position?.x);
        const yParsed = parseLayoutCoord(table?.y ?? table?.top ?? table?.posY ?? table?.position?.y);
        const defaultX = 120 + index * 180;
        const defaultY = 120 + (index % 3) * 120;
        return {
        id: String(table?.id || `tbl-${index + 1}`),
        name: String(table?.name || `T-${String(index + 1).padStart(2, '0')}`),
        x: hasExplicitTableX(table) ? xParsed : defaultX,
        y: hasExplicitTableY(table) ? yParsed : defaultY,
        width: Math.max(60, Number(table?.width) || 120),
        height: Math.max(40, Number(table?.height) || 80),
        chairs: Math.max(0, Number(table?.chairs) || 4),
        rotation: Number(table?.rotation) || 0,
        round: !!table?.round,
        templateType: TABLE_TEMPLATE_OPTIONS.some((tpl) => tpl.id === table?.templateType)
          ? table.templateType
          : (Number(table?.chairs) || 4) >= 6
            ? '6table'
            : (Number(table?.chairs) || 4) >= 5
              ? '5table'
              : '4table',
        boards: (() => {
          if (Array.isArray(table?.boards) && table.boards.length > 0) {
            return table.boards.map((b) => normalizeBoardToItem(b));
          }
          if (table?.board && typeof table.board === 'object') {
            return [normalizeBoardToItem(table.board)];
          }
          if (typeof table?.boardColor === 'string' && table.boardColor.trim()) {
            return [normalizeBoardToItem(createDefaultBoard(table, table.boardColor.trim()))];
          }
          return [];
        })(),
        flowerPots:
          Array.isArray(table?.flowerPots) && table.flowerPots.length > 0
            ? table.flowerPots.map((fp) => normalizeFlowerPotToItem(fp))
            : table?.flowerPot && typeof table.flowerPot === 'object'
              ? [normalizeFlowerPotToItem(table.flowerPot)]
              : []
        };
      })
    : [];
  return {
    floorName: String(raw?.floorName || locationName || 'Restaurant'),
    floorWidth: SET_TABLES_LAYOUT_CANVAS_WIDTH,
    floorHeight: SET_TABLES_LAYOUT_CANVAS_HEIGHT,
    bookingCapacity: Math.max(0, Number(raw?.bookingCapacity) || 0),
    floors: Math.max(1, Number(raw?.floors) || 1),
    tables: hasTablesArray ? tables : [createDefaultLayoutTable(1)]
  };
}

/** Coerce values for controlled `<input type="number" />` / `range` (React warns if `value` is NaN). */
export function safeNumberInputValue(value, fallback = 0) {
  const fb = Number(fallback);
  const safeFb = Number.isFinite(fb) ? fb : 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : safeFb;
}

import { decorateBlock, loadBlock, toClassName } from '../../scripts/aem.js';

const GRID_UNITS = 12;

// Read the layout preset from the container's `layout-*` class (set via the
// block's Layout dropdown). Returns an array of column widths, e.g.
// `layout-8-4` -> [8, 4]. Falls back to null when absent.
function readLayout(block) {
  const cls = [...block.classList].find((c) => /^layout-\d+(-\d+)*$/.test(c));
  return cls ? cls.replace('layout-', '').split('-').map(Number) : null;
}

// Distribute 12 units equally across n columns (remainder into the last).
function equalWidths(n) {
  const base = Math.floor(GRID_UNITS / n);
  const widths = new Array(n).fill(base);
  widths[n - 1] += GRID_UNITS - base * n;
  return widths;
}

// Resolve final per-column widths for the given column count.
// Prefer the authored layout preset; if its length doesn't match the number of
// columns (author added/removed a column), fall back to an equal split.
function resolveWidths(layout, columnCount) {
  const n = columnCount || 1;
  if (layout && layout.length === n) {
    const total = layout.reduce((sum, w) => sum + w, 0);
    if (total !== GRID_UNITS) {
      // eslint-disable-next-line no-console
      console.warn(`Total column width must equal 12. Current total: ${total}`);
      return equalWidths(n);
    }
    return layout;
  }
  return equalWidths(n);
}

// Convert a nested block authored as a raw <table> into standard EDS block DOM:
// <div class="<name> block"> rows/cells </div>.
//
// WHY tables: a block placed inside a Column Control cell is NOT a top-level
// section block, and the crosswalk -> helix-md2jcr delivery pipeline only
// converts top-level block tables. A nested block *node* is flattened on
// delivery to a classless <div> (its block name is lost), so it can never be
// reconstructed client-side. The durable cross-environment carrier for a nested
// block is therefore a table whose header cell names the block — this survives
// md2jcr intact, and we rebuild the block DOM from it here at runtime. The
// resulting DOM is identical to a top-level block, so decorateBlock/loadBlock
// load it exactly like a normally-authored block.
//
// The header cell may carry a variant, e.g. "Cards (logos)" -> classes
// ["cards", "logos"]; the first token is the block name.
function tableToBlock(table) {
  const headerText = table.querySelector('thead th, thead td')?.textContent.trim() || '';
  if (!headerText) return null;
  const classes = headerText
    .split(/[(),]/) // "Name (variant)" -> ["Name ", " variant", ""]
    .map((s) => toClassName(s.trim()))
    .filter(Boolean);
  if (!classes.length) return null;
  const [name] = classes;
  const wrapper = document.createElement('div');
  wrapper.className = `${classes.join(' ')} block`;
  wrapper.dataset.blockName = name;
  table.querySelectorAll('tbody tr').forEach((tr) => {
    const rowDiv = document.createElement('div');
    [...tr.children].forEach((td) => {
      const cellDiv = document.createElement('div');
      cellDiv.append(...td.childNodes);
      rowDiv.append(cellDiv);
    });
    wrapper.append(rowDiv);
  });
  table.replaceWith(wrapper);
  return wrapper;
}

// Decorate + load every block authored inside the columns, so nested blocks
// load exactly like top-level ones (EDS only auto-decorates top-level section
// blocks; anything nested is the container's responsibility).
//
// Two shapes are handled:
//  - Author/UE preview: the nested block is delivered as real block DOM
//    (<div class="<name> block">) — collected directly.
//  - Published .page: the nested block is delivered as a table carrier (see
//    tableToBlock) — converted to block DOM first.
// Each block is wrapped in its own <div> so the EDS-added `<name>-wrapper`
// class lands on that wrapper, not on the `.grid-column` cell.
async function loadNestedBlocks(columns) {
  // 1) Convert any table carriers to block DOM first (published .page).
  columns.forEach((col) => {
    col.querySelectorAll(':scope table').forEach((table) => tableToBlock(table));
  });
  // 2) Collect nested block divs — both the ones just built from tables and any
  // block DOM delivered directly (author preview). Search descendants (the
  // pipeline may wrap a nested block in a <p>/<div>, so `:scope > div` would
  // miss it): a nested block is a classed div that isn't the grid-column cell
  // and hasn't been decorated yet.
  const nested = columns.flatMap((col) => [
    ...col.querySelectorAll('div[class]:not([data-block-status])'),
  ].filter((el) => el.classList.length && !el.classList.contains('grid-column')));
  await Promise.all(nested.map(async (el) => {
    const wrapper = document.createElement('div');
    el.replaceWith(wrapper);
    wrapper.append(el);
    decorateBlock(el);
    await loadBlock(el);
  }));
}

export default function decorate(block) {
  // A columns container delivers its cells inside a single intermediate row div.
  const rows = [...block.children];
  let row;
  let columns;
  if (rows.length === 1 && rows[0].children.length > 1) {
    [row] = rows;
    columns = [...row.children];
  } else {
    row = block;
    columns = rows;
  }

  row.classList.add('row');

  const layout = readLayout(block);
  const widths = resolveWidths(layout, columns.length);
  columns.forEach((col, i) => {
    col.classList.add('grid-column', `col-lg-${widths[i]}`);
  });

  loadNestedBlocks(columns);
}

import { decorateBlock, loadBlock } from '../../scripts/aem.js';

const GRID_UNITS = 12;

function readLayout(block) {
  const cls = [...block.classList].find((c) => /^layout-\d+(-\d+)*$/.test(c));
  return cls ? cls.replace('layout-', '').split('-').map(Number) : null;
}

function equalWidths(n) {
  const base = Math.floor(GRID_UNITS / n);
  const widths = new Array(n).fill(base);
  widths[n - 1] += GRID_UNITS - base * n;
  return widths;
}

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

async function loadNestedBlocks(columns) {
  const nestedBlocks = columns.flatMap((column) => [
    ...column.querySelectorAll('[data-aue-component]:not([data-block-status])'),
  ]);

  await Promise.all(
    nestedBlocks.map(async (block) => {
      console.log('Loading nested block:', block.dataset.aueComponent);

      decorateBlock(block);
      await loadBlock(block);
    }),
  );
}

export default async function decorate(block) {
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

  columns.forEach((column, index) => {
    column.classList.add(
      'grid-column',
      `col-lg-${widths[index]}`,
    );
  });

  await loadNestedBlocks(columns);
}

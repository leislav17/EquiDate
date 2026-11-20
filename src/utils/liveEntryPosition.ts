/** Parse the optional entry label, retaining a display value independent of row identity. */
export function parseLiveEntryLabel(value: string): string | null {
  const label = value.trim();
  if (!label) return null;
  if (/^[a-z]$/i.test(label)) return label.toUpperCase();
  const match = /^(\d+)( bis)?$/i.exec(label);
  if (!match || Number(match[1]) < 1 || !Number.isSafeInteger(Number(match[1]))) {
    throw new Error('Ingresá una letra, un número o un número seguido de bis.');
  }
  return String(Number(match[1])) + (match[2] ? ' bis' : '');
}

function sortKey(label: string): [number, number, number] {
  if (/^[A-Z]$/.test(label)) return [0, label.charCodeAt(0), 0];
  const match = /^(\d+)( bis)?$/.exec(label);
  if (!match) throw new Error('Orden de ingreso inválido.');
  return [1, Number(match[1]), match[2] ? 1 : 0];
}

/** Find the insertion index without modifying the current live sequence. */
export function liveInsertionIndex(
  labels: (string | null)[],
  currentIndex: number | null,
  newLabel: string | null,
): number {
  if (newLabel === null) {
    return currentIndex !== null && currentIndex >= 0 && currentIndex < labels.length
      ? currentIndex + 1 : labels.length;
  }
  const key = sortKey(newLabel);
  const index = labels.findIndex(label => {
    if (label === null) return false;
    const other = sortKey(label);
    return other[0] > key[0] ||
      (other[0] === key[0] && (other[1] > key[1] ||
        (other[1] === key[1] && other[2] > key[2])));
  });
  return index < 0 ? labels.length : index;
}

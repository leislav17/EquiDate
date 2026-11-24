export const behaviors = {
  TD: 'Tiempo directo',
  '2F': 'Doble faz común',
  '2FE': 'Doble faz especial',
  '1D': 'Un desempate',
  DC: 'Desempate continuado',
  DR: 'Doble recorrido',
  TOD: 'Tiempo óptimo directo',
} as const;

export type Behavior = keyof typeof behaviors;
export type CatalogKind = 'rider' | 'horse' | 'definition';
export type CatalogItem = {
  id: string;
  kind: CatalogKind;
  code: string;
  name: string;
  active: boolean;
  behavior: Behavior | null;
  aliases: string[];
};

export type CatalogSelection = {
  definitionId: string;
  categoryIds: string[];
  heightCm: number;
  secondHeightCm: number | null;
  specialName: string | null;
  entryFee: number | null;
};

export type ClassCatalog = CatalogSelection & {
  definition: Omit<CatalogItem, 'active'>;
  categories: Omit<CatalogItem, 'active'>[];
};

export function hasSecondPart(behavior: Behavior | null | undefined): boolean {
  return !!behavior && behavior !== 'TD' && behavior !== 'TOD';
}

export function classTitle(selection: CatalogSelection, code: string): string {
  const meters = (height: number) => (height / 100).toFixed(2).replace('.', ',');
  const height = [selection.heightCm, selection.secondHeightCm].flatMap(value => value == null ? [] : [meters(value)]).join('/');
  return [height + ' m', code, selection.specialName].filter(Boolean).join(' · ');
}

export function categoryKey(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
}

export function liveCategoryName(catalog: ClassCatalog | null | undefined, value?: string): string | undefined {
  if (!catalog || !value) return value;
  const key = categoryKey(value);
  return catalog.categories.find(category =>
    [category.name, category.code, ...category.aliases].some(label => categoryKey(label) === key)
  )?.name;
}

export function catalogSelection(catalog: ClassCatalog): CatalogSelection {
  const { definitionId, categoryIds, heightCm, secondHeightCm, specialName, entryFee } = catalog;
  return { definitionId, categoryIds, heightCm, secondHeightCm, specialName, entryFee };
}

export function entryFeeLabel(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
}

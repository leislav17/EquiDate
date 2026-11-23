import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import {
  SponsorCategory,
  SponsorItem,
  SponsorPlacement,
  SponsorScope,
  SponsorVariant,
} from '../../types/equestrian';
import {
  isSponsorActiveOnDate,
  safeSponsorUrl,
  SPONSOR_PLACEMENT_LABELS,
  SPONSOR_VARIANT_LABELS,
} from '../../utils/sponsors';
import { SponsorCardTile } from '../public/SponsorSection';

interface SponsorManagerProps {
  scope: SponsorScope;
  eventId?: string | null;
  onDirtyChange?: (isDirty: boolean) => void;
  onBack?: () => void;
}

interface SponsorFormState {
  id?: string;
  name: string;
  subtitle: string;
  categoryId: string;
  imageUrl: string;
  mobileImageUrl: string;
  targetUrl: string;
  placement: SponsorPlacement;
  variant: SponsorVariant;
  sortOrder: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
}

const buildEmptyForm = (
  scope: SponsorScope,
  existing: SponsorItem[],
  categories: SponsorCategory[]
): SponsorFormState => {
  const maxOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), 0);
  return {
    name: '',
    subtitle: '',
    categoryId: categories[0]?.id || '',
    imageUrl: '',
    mobileImageUrl: '',
    targetUrl: '',
    placement: scope === 'event' ? 'event_detail' : 'all',
    variant: 'logo_card',
    sortOrder: maxOrder + 10,
    active: true,
    startsAt: '',
    endsAt: '',
  };
};

export const SponsorManager: React.FC<SponsorManagerProps> = ({
  scope,
  eventId = null,
  onDirtyChange,
  onBack,
}) => {
  const {
    sponsors,
    sponsorsAvailable,
    sponsorsError,
    sponsorCategories,
    sponsorCategoriesAvailable,
    sponsorCategoriesError,
    saveSponsor,
    deleteSponsor,
    toggleSponsorActive,
    uploadSponsorImage,
    saveSponsorCategory,
    deleteSponsorCategory,
  } = useEquestrian();

  const categoryNameById = useMemo(
    () => new Map(sponsorCategories.map((c) => [c.id, c.name])),
    [sponsorCategories]
  );

  const sponsorCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sponsors) {
      if (s.categoryId) {
        counts.set(s.categoryId, (counts.get(s.categoryId) || 0) + 1);
      }
    }
    return counts;
  }, [sponsors]);

  const scopedSponsors = sponsors
    .filter((item) =>
      scope === 'global'
        ? item.scope === 'global'
        : item.scope === 'event' && item.eventId === eventId
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));

  const [editing, setEditing] = useState<SponsorFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [showMobileManualUrl, setShowMobileManualUrl] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Quick category creation inside sponsor form
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState('');
  const [quickCategoryBusy, setQuickCategoryBusy] = useState(false);

  // Full category management panel (available in global view or toggleable)
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryOrder, setNewCategoryOrder] = useState<number>(() =>
    sponsorCategories.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 10
  );
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    sortOrder: number;
  } | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);

  const desktopFileRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onDirtyChange?.(editing !== null || editingCategory !== null);
  }, [editing, editingCategory, onDirtyChange]);

  useEffect(() => {
    setNewCategoryOrder(
      sponsorCategories.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 10
    );
  }, [sponsorCategories]);

  const startNew = () => {
    setError('');
    setSuccess('');
    setShowManualUrl(false);
    setShowMobileManualUrl(false);
    setShowQuickCategory(false);
    setQuickCategoryName('');
    setEditing(buildEmptyForm(scope, scopedSponsors, sponsorCategories));
  };

  const startEdit = (item: SponsorItem) => {
    setError('');
    setSuccess('');
    setShowManualUrl(false);
    setShowMobileManualUrl(false);
    setShowQuickCategory(false);
    setQuickCategoryName('');
    setEditing({
      id: item.id,
      name: item.name,
      subtitle: item.subtitle || '',
      categoryId: item.categoryId || '',
      imageUrl: item.imageUrl,
      mobileImageUrl: item.mobileImageUrl || '',
      targetUrl: item.targetUrl || '',
      placement: item.placement,
      variant: item.variant,
      sortOrder: item.sortOrder,
      active: item.active,
      startsAt: item.startsAt || '',
      endsAt: item.endsAt || '',
    });
  };

  const handleImageUpload = async (
    file: File | undefined,
    target: 'desktop' | 'mobile'
  ) => {
    if (!file || !editing) return;
    setError('');
    if (target === 'desktop') setUploadingDesktop(true);
    else setUploadingMobile(true);

    try {
      const publicUrl = await uploadSponsorImage(file);
      setEditing((prev) =>
        prev
          ? target === 'desktop'
            ? { ...prev, imageUrl: publicUrl }
            : { ...prev, mobileImageUrl: publicUrl }
          : prev
      );
    } catch (err) {
      setError((err as Error).message || 'No se pudo subir la imagen.');
    } finally {
      if (target === 'desktop') setUploadingDesktop(false);
      else setUploadingMobile(false);
    }
  };

  const handleQuickCreateCategory = async () => {
    if (!editing) return;
    setError('');
    setSuccess('');
    setQuickCategoryBusy(true);
    try {
      const created = await saveSponsorCategory({ name: quickCategoryName });
      setEditing((prev) => (prev ? { ...prev, categoryId: created.id } : prev));
      setQuickCategoryName('');
      setShowQuickCategory(false);
      setSuccess(`Categoría «${created.name}» agregada.`);
    } catch (err) {
      setError((err as Error).message || 'No se pudo crear la categoría.');
    } finally {
      setQuickCategoryBusy(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCategoryBusy(true);
    try {
      const created = await saveSponsorCategory({
        name: newCategoryName,
        sortOrder: newCategoryOrder,
      });
      setNewCategoryName('');
      setSuccess(`Categoría «${created.name}» creada.`);
    } catch (err) {
      setError((err as Error).message || 'No se pudo crear la categoría.');
    } finally {
      setCategoryBusy(false);
    }
  };

  const handleSaveCategoryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setError('');
    setSuccess('');
    setCategoryBusy(true);
    try {
      const updated = await saveSponsorCategory(editingCategory);
      setEditingCategory(null);
      setSuccess(`Categoría «${updated.name}» actualizada.`);
    } catch (err) {
      setError((err as Error).message || 'No se pudo actualizar la categoría.');
    } finally {
      setCategoryBusy(false);
    }
  };

  const handleDeleteCategory = async (category: SponsorCategory) => {
    const count = sponsorCountByCategory.get(category.id) || 0;
    const msg =
      count > 0
        ? `¿Eliminar la categoría «${category.name}»? Los ${count} sponsor(s) asignados permanecerán cargados sin categoría.`
        : `¿Eliminar la categoría «${category.name}»?`;
    if (!window.confirm(msg)) return;
    setError('');
    setSuccess('');
    setCategoryBusy(true);
    try {
      await deleteSponsorCategory(category.id);
      if (editing?.categoryId === category.id) {
        setEditing((prev) => (prev ? { ...prev, categoryId: '' } : prev));
      }
      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
      }
      setSuccess(`Categoría «${category.name}» eliminada.`);
    } catch (err) {
      setError((err as Error).message || 'No se pudo eliminar la categoría.');
    } finally {
      setCategoryBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    setSuccess('');

    if (!editing.name.trim()) {
      setError('Ingresá el nombre del sponsor.');
      return;
    }
    if (!safeSponsorUrl(editing.imageUrl)) {
      setError('Subí una imagen o ingresá una URL http/https válida.');
      return;
    }
    if (editing.mobileImageUrl.trim() && !safeSponsorUrl(editing.mobileImageUrl)) {
      setError('La imagen para celular debe tener una URL http/https válida.');
      return;
    }
    if (editing.targetUrl.trim() && !safeSponsorUrl(editing.targetUrl)) {
      setError('El enlace de destino debe comenzar con https:// o http://.');
      return;
    }
    if (editing.startsAt && editing.endsAt && editing.startsAt > editing.endsAt) {
      setError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    setBusy(true);
    try {
      await saveSponsor({
        id: editing.id,
        name: editing.name.trim(),
        subtitle: editing.subtitle.trim() || undefined,
        categoryId: editing.categoryId || null,
        imageUrl: editing.imageUrl.trim(),
        mobileImageUrl: editing.mobileImageUrl.trim() || undefined,
        targetUrl: editing.targetUrl.trim() || undefined,
        scope,
        eventId: scope === 'event' ? eventId : null,
        placement: scope === 'event' ? 'event_detail' : editing.placement,
        variant: editing.variant,
        sortOrder: Number.isFinite(editing.sortOrder) ? editing.sortOrder : 0,
        active: editing.active,
        startsAt: editing.startsAt || null,
        endsAt: editing.endsAt || null,
      });
      setSuccess(editing.id ? 'Sponsor actualizado.' : 'Sponsor creado correctamente.');
      setEditing(null);
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar el sponsor.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (item: SponsorItem) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await toggleSponsorActive(item.id);
      setSuccess(item.active ? `«${item.name}» pausado.` : `«${item.name}» activado.`);
    } catch (err) {
      setError((err as Error).message || 'No se pudo cambiar el estado.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: SponsorItem) => {
    if (!window.confirm(`¿Eliminar el sponsor «${item.name}»?`)) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await deleteSponsor(item.id);
      if (editing?.id === item.id) setEditing(null);
      setSuccess('Sponsor eliminado.');
    } catch (err) {
      setError((err as Error).message || 'No se pudo eliminar el sponsor.');
    } finally {
      setBusy(false);
    }
  };

  const previewSponsor: SponsorItem | null =
    editing && safeSponsorUrl(editing.imageUrl)
      ? {
          id: editing.id || 'preview',
          name: editing.name.trim() || 'Nombre del sponsor',
          subtitle: editing.subtitle.trim() || undefined,
          categoryId: editing.categoryId || null,
          imageUrl: editing.imageUrl.trim(),
          mobileImageUrl: safeSponsorUrl(editing.mobileImageUrl)
            ? editing.mobileImageUrl.trim()
            : undefined,
          targetUrl: safeSponsorUrl(editing.targetUrl) ? editing.targetUrl.trim() : undefined,
          scope,
          eventId: scope === 'event' ? eventId : null,
          placement: scope === 'event' ? 'event_detail' : editing.placement,
          variant: editing.variant,
          sortOrder: editing.sortOrder,
          active: editing.active,
          startsAt: editing.startsAt || null,
          endsAt: editing.endsAt || null,
          createdAt: '',
          updatedAt: '',
        }
      : null;

  const inputClass =
    'mt-1 block w-full min-h-11 px-3 py-2 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#123E59]/25';

  return (
    <div className={scope === 'global' ? 'equidate-container py-6 sm:py-8 space-y-5' : 'space-y-5'}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#123E59] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al panel</span>
        </button>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {scope === 'global' ? (
            <h1 className="font-display text-2xl font-black text-[#123E59]">
              Sponsors globales
            </h1>
          ) : (
            <h3 className="font-display text-base font-black text-[#123E59] uppercase tracking-wide">
              Sponsors de este concurso
            </h3>
          )}
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            {scope === 'global'
              ? 'Marcas del sector ecuestre agrupadas por categoría en la portada y al pie de listados, resultados y buscador.'
              : 'Auspiciantes propios de este concurso agrupados por categoría. Si cargás sponsors acá, reemplazan a los globales en la ficha del evento.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {sponsorsAvailable && sponsorCategoriesAvailable && (
            <button
              type="button"
              onClick={() => setShowCategoryManager((v) => !v)}
              className={`inline-flex items-center gap-1.5 min-h-11 px-3.5 py-2 border text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer ${
                showCategoryManager
                  ? 'border-[#123E59] bg-[#123E59]/5 text-[#123E59]'
                  : 'border-neutral-300 bg-white text-[#123E59] hover:bg-neutral-50'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Categorías ({sponsorCategories.length})</span>
            </button>
          )}

          {sponsorsAvailable && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={startNew}
              className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{scope === 'global' ? 'Nuevo sponsor global' : 'Agregar sponsor al concurso'}</span>
            </button>
          )}
        </div>
      </div>

      {!sponsorsAvailable && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm"
        >
          La tabla de sponsors todavía no está aplicada en Supabase. Ejecutá las migraciones
          pendientes para habilitar la carga de auspiciantes.
        </div>
      )}

      {sponsorsAvailable && !sponsorCategoriesAvailable && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm"
        >
          La tabla de categorías todavía no está aplicada en Supabase. Ejecutá la migración de
          categorías para agrupar los sponsors por rubro.
        </div>
      )}

      {sponsorsError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm">
          {sponsorsError}
        </div>
      )}

      {sponsorCategoriesError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm">
          {sponsorCategoriesError}
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-semibold">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Panel de gestión de categorías */}
      {showCategoryManager && sponsorCategoriesAvailable && (
        <section
          aria-label="Gestión de categorías de sponsors"
          className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <h4 className="font-display text-base font-black text-[#123E59]">
                Categorías de sponsors
              </h4>
              <p className="text-xs text-neutral-500">
                Los sponsors visibles se agrupan y ordenan según estas categorías.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setShowCategoryManager(false);
              }}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-800 min-h-11 px-2 cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="flex-1 text-xs font-bold text-neutral-800">
              Nueva categoría
              <input
                type="text"
                required
                maxLength={80}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ej. Veterinaria, Transporte, Indumentaria..."
                className={inputClass}
              />
            </label>
            <label className="w-full sm:w-28 text-xs font-bold text-neutral-800">
              Orden
              <input
                type="number"
                step={1}
                value={newCategoryOrder}
                onChange={(e) => setNewCategoryOrder(Number(e.target.value) || 0)}
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={categoryBusy || !newCategoryName.trim()}
              className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
            >
              {categoryBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Agregar categoría</span>
            </button>
          </form>

          {sponsorCategories.length === 0 ? (
            <p className="text-xs text-neutral-500">Todavía no hay categorías cargadas.</p>
          ) : (
            <div className="divide-y divide-neutral-100 border border-neutral-200/80 rounded-xl overflow-hidden">
              {sponsorCategories.map((category) => {
                const isEditingCat = editingCategory?.id === category.id;
                const count = sponsorCountByCategory.get(category.id) || 0;

                return (
                  <div
                    key={category.id}
                    className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {isEditingCat ? (
                      <form
                        onSubmit={handleSaveCategoryEdit}
                        className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2"
                      >
                        <input
                          type="text"
                          required
                          maxLength={80}
                          value={editingCategory.name}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, name: e.target.value })
                          }
                          aria-label="Nombre de categoría"
                          className="flex-1 min-h-11 px-3 py-2 bg-white border border-neutral-300 rounded-xl text-sm"
                        />
                        <input
                          type="number"
                          step={1}
                          value={editingCategory.sortOrder}
                          onChange={(e) =>
                            setEditingCategory({
                              ...editingCategory,
                              sortOrder: Number(e.target.value) || 0,
                            })
                          }
                          aria-label="Orden de categoría"
                          className="w-full sm:w-24 min-h-11 px-3 py-2 bg-white border border-neutral-300 rounded-xl text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={categoryBusy}
                            className="min-h-11 px-3.5 py-2 bg-[#123E59] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            disabled={categoryBusy}
                            onClick={() => setEditingCategory(null)}
                            className="min-h-11 px-3 py-2 text-xs font-semibold text-neutral-600 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#123E59] break-words">
                            {category.name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            Orden {category.sortOrder} · {count}{' '}
                            {count === 1 ? 'sponsor asignado' : 'sponsors asignados'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={categoryBusy}
                            onClick={() =>
                              setEditingCategory({
                                id: category.id,
                                name: category.name,
                                sortOrder: category.sortOrder,
                              })
                            }
                            className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 text-xs font-bold rounded-xl border border-neutral-200 text-[#123E59] hover:bg-neutral-50 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            disabled={categoryBusy}
                            onClick={() => void handleDeleteCategory(category)}
                            className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 text-xs font-bold rounded-xl border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {editing && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-3">
            <h4 className="font-display text-base sm:text-lg font-black text-[#123E59]">
              {editing.id ? 'Editar sponsor' : 'Nuevo sponsor'}
            </h4>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-800 min-h-11 px-2 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs sm:text-sm font-bold text-neutral-800">
              Nombre de la marca *
              <input
                type="text"
                required
                maxLength={120}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ej. Talabartería del Plata"
                className={inputClass}
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="sponsor-category-select"
                  className="text-xs sm:text-sm font-bold text-neutral-800"
                >
                  Categoría
                </label>
                {sponsorCategoriesAvailable && (
                  <button
                    type="button"
                    onClick={() => setShowQuickCategory((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#123E59] hover:underline cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{showQuickCategory ? 'Cerrar' : '+ Nueva categoría'}</span>
                  </button>
                )}
              </div>

              <select
                id="sponsor-category-select"
                disabled={!sponsorCategoriesAvailable}
                value={editing.categoryId}
                onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                className={`${inputClass} mt-0`}
              >
                <option value="">Sin categoría</option>
                {sponsorCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              {showQuickCategory && sponsorCategoriesAvailable && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    maxLength={80}
                    value={quickCategoryName}
                    onChange={(e) => setQuickCategoryName(e.target.value)}
                    placeholder="Nombre de nueva categoría"
                    aria-label="Nombre de nueva categoría"
                    className="flex-1 min-h-11 px-3 py-2 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#123E59]/25"
                  />
                  <button
                    type="button"
                    disabled={quickCategoryBusy || !quickCategoryName.trim()}
                    onClick={() => void handleQuickCreateCategory()}
                    className="min-h-11 px-3.5 py-2 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {quickCategoryBusy ? 'Creando…' : 'Crear'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <label className="block text-xs sm:text-sm font-bold text-neutral-800">
            Descripción breve (opcional)
            <input
              type="text"
              maxLength={120}
              value={editing.subtitle}
              onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
              placeholder="Ej. Equipamiento y monturas de salto"
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] font-normal text-neutral-500">
              Se muestra debajo del nombre en la sección «Sponsors EquiDate» del menú (en portada, concursos y listados solo se ve la imagen).
            </span>
          </label>

          {/* Imagen principal */}
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm font-bold text-neutral-800">
                  Imagen o logotipo de la marca *
                </p>
                <p className="text-[11px] text-neutral-500">
                  JPG, PNG o WebP hasta 5 MB. La tarjeta pública se ajusta al tamaño de la imagen.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={desktopFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void handleImageUpload(e.target.files?.[0], 'desktop');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingDesktop || busy}
                  onClick={() => desktopFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 min-h-11 px-3.5 py-2 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {uploadingDesktop ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploadingDesktop ? 'Subiendo…' : 'Subir imagen'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualUrl((v) => !v)}
                  className="min-h-11 px-3 text-xs font-semibold text-[#123E59] underline cursor-pointer"
                >
                  {showManualUrl ? 'Ocultar URL manual' : 'Usar URL externa'}
                </button>
              </div>
            </div>

            {(showManualUrl || editing.imageUrl) && (
              <label className="block text-xs font-semibold text-neutral-600">
                URL de imagen
                <input
                  type="url"
                  value={editing.imageUrl}
                  onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className={inputClass}
                />
              </label>
            )}
          </div>

          {/* Imagen móvil opcional cuando es banner */}
          {editing.variant === 'banner' && (
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-neutral-800">
                    Imagen adaptada para celular (opcional)
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Útil si el banner horizontal de escritorio tiene texto chico y querés una versión más compacta en teléfonos.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={mobileFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      void handleImageUpload(e.target.files?.[0], 'mobile');
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadingMobile || busy}
                    onClick={() => mobileFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 min-h-11 px-3.5 py-2 border border-[#123E59] text-[#123E59] hover:bg-[#123E59]/5 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {uploadingMobile ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                    <span>{uploadingMobile ? 'Subiendo…' : 'Subir versión móvil'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMobileManualUrl((v) => !v)}
                    className="min-h-11 px-3 text-xs font-semibold text-[#123E59] underline cursor-pointer"
                  >
                    {showMobileManualUrl ? 'Ocultar URL' : 'Pegar URL'}
                  </button>
                </div>
              </div>

              {(showMobileManualUrl || editing.mobileImageUrl) && (
                <label className="block text-xs font-semibold text-neutral-600">
                  URL de imagen móvil
                  <input
                    type="url"
                    value={editing.mobileImageUrl}
                    onChange={(e) => setEditing({ ...editing, mobileImageUrl: e.target.value })}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </label>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block text-xs sm:text-sm font-bold text-neutral-800">
              Enlace al sitio o Instagram (opcional)
              <input
                type="url"
                value={editing.targetUrl}
                onChange={(e) => setEditing({ ...editing, targetUrl: e.target.value })}
                placeholder="https://..."
                className={inputClass}
              />
            </label>

            {scope === 'global' && (
              <label className="block text-xs sm:text-sm font-bold text-neutral-800">
                Ubicación en la plataforma
                <select
                  value={editing.placement}
                  onChange={(e) =>
                    setEditing({ ...editing, placement: e.target.value as SponsorPlacement })
                  }
                  className={inputClass}
                >
                  <option value="all">{SPONSOR_PLACEMENT_LABELS.all}</option>
                  <option value="home">{SPONSOR_PLACEMENT_LABELS.home}</option>
                  <option value="listings_footer">{SPONSOR_PLACEMENT_LABELS.listings_footer}</option>
                </select>
              </label>
            )}

            <label className="block text-xs sm:text-sm font-bold text-neutral-800">
              Formato visual
              <select
                value={editing.variant}
                onChange={(e) =>
                  setEditing({ ...editing, variant: e.target.value as SponsorVariant })
                }
                className={inputClass}
              >
                <option value="logo_card">{SPONSOR_VARIANT_LABELS.logo_card}</option>
                <option value="banner">{SPONSOR_VARIANT_LABELS.banner}</option>
              </select>
            </label>

            <label className="block text-xs sm:text-sm font-bold text-neutral-800">
              Orden dentro de la categoría
              <input
                type="number"
                step={1}
                value={editing.sortOrder}
                onChange={(e) =>
                  setEditing({ ...editing, sortOrder: Number(e.target.value) || 0 })
                }
                className={inputClass}
              />
            </label>

            <label className="block text-xs sm:text-sm font-bold text-neutral-800">
              Vigencia desde (opcional)
              <input
                type="date"
                value={editing.startsAt}
                onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })}
                className={inputClass}
              />
            </label>

            <label className="block text-xs sm:text-sm font-bold text-neutral-800">
              Vigencia hasta (opcional)
              <input
                type="date"
                value={editing.endsAt}
                onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-3 min-h-11 text-sm font-semibold text-neutral-800 cursor-pointer">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              className="w-4 h-4 accent-[#123E59]"
            />
            <span>Activo (visible en el sitio público según vigencia)</span>
          </label>

          {previewSponsor && (
            <div className="p-4 rounded-2xl bg-[#f4f6f8] border border-neutral-200/80 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                Vista previa pública
                {editing.categoryId && categoryNameById.get(editing.categoryId)
                  ? ` · ${categoryNameById.get(editing.categoryId)}`
                  : ''}
              </p>
              <div className={previewSponsor.variant === 'logo_card' ? 'max-w-xs' : 'w-full'}>
                <SponsorCardTile sponsor={previewSponsor} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100">
            <button
              type="submit"
              disabled={busy || uploadingDesktop || uploadingMobile}
              className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editing.id ? 'Guardar cambios' : 'Crear sponsor'}</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
              className="min-h-11 px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Listado */}
      {sponsorsAvailable && (
        <div className="space-y-3">
          {scopedSponsors.length === 0 ? (
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 text-center text-sm text-neutral-500">
              {scope === 'global'
                ? 'Todavía no cargaste sponsors globales.'
                : 'Este concurso todavía no tiene sponsors propios.'}
            </div>
          ) : (
            scopedSponsors.map((item) => {
              const liveNow = isSponsorActiveOnDate(item);
              const categoryName = item.categoryId ? categoryNameById.get(item.categoryId) : null;
              return (
                <article
                  key={item.id}
                  className="bg-white border border-neutral-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-20 h-14 rounded-xl border border-neutral-200 bg-white p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm sm:text-base text-[#123E59] break-words">
                          {item.name}
                        </h4>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                            liveNow
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.active
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {liveNow ? 'VISIBLE' : item.active ? 'FUERA DE FECHA' : 'PAUSADO'}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-neutral-600 break-words">{item.subtitle}</p>
                      )}
                      <p className="text-xs text-neutral-500 break-words">
                        {categoryName ? `${categoryName} · ` : ''}Orden {item.sortOrder} ·{' '}
                        {SPONSOR_VARIANT_LABELS[item.variant]}
                        {scope === 'global' ? ` · ${SPONSOR_PLACEMENT_LABELS[item.placement]}` : ''}
                        {(item.startsAt || item.endsAt) &&
                          ` · Vigencia: ${item.startsAt || 'sin inicio'} a ${item.endsAt || 'sin fin'}`}
                      </p>
                      {item.targetUrl && (
                        <a
                          href={item.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#123E59] underline break-all"
                        >
                          <span>{item.targetUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleToggle(item)}
                      className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 text-xs font-bold rounded-xl border border-neutral-200 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                    >
                      {item.active ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Pausar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Activar</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(item)}
                      className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 text-xs font-bold rounded-xl border border-neutral-200 text-[#123E59] hover:bg-neutral-50 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(item)}
                      className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 text-xs font-bold rounded-xl border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

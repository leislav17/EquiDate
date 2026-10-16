import React, { useState, useRef } from 'react';
import { Heading, Bold, List, Link as LinkIcon, Eye, Edit3, Trash2 } from 'lucide-react';
import { renderRichText } from '../../utils/richText';

interface ImportantInfoEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ImportantInfoEditor: React.FC<ImportantInfoEditorProps> = ({
  value,
  onChange,
  placeholder = 'Escribí la información importante del concurso aquí...',
  disabled = false,
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertSnippet = (prefix: string, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end) || defaultText;
    const before = value.substring(0, start);
    const after = value.substring(end);

    const isNewLineNeeded = prefix.startsWith('#') || prefix.startsWith('-');
    const leadingBreak = isNewLineNeeded && before.length > 0 && !before.endsWith('\n') ? '\n' : '';

    const newText = `${before}${leadingBreak}${prefix}${selected}${suffix}${after}`;
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + leadingBreak.length + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleAddHeading = () => insertSnippet('## ', '', 'Título');
  const handleAddBold = () => insertSnippet('**', '**', 'texto en negrita');
  const handleAddList = () => insertSnippet('- ', '', 'Elemento de lista');
  const handleAddLink = () => {
    const url = window.prompt('Ingresá la URL del enlace (ej: https://forms.gle/...)');
    if (!url) return;
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    insertSnippet('[', `](${cleanUrl})`, 'Formulario de inscripción');
  };

  return (
    <div className="border border-neutral-300 rounded-xl overflow-hidden bg-white focus-within:border-[#123E59] focus-within:ring-1 focus-within:ring-[#123E59] transition-all">
      {/* Editor Header: Tabs & Toolbar */}
      <div className="bg-neutral-100/80 px-3 py-2 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2">
        {/* Formatting buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled || activeTab === 'preview'}
            onClick={handleAddHeading}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/80 rounded transition-colors disabled:opacity-40 cursor-pointer"
            title="Título (##)"
            aria-label="Agregar título"
          >
            <Heading className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={disabled || activeTab === 'preview'}
            onClick={handleAddBold}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/80 rounded transition-colors disabled:opacity-40 cursor-pointer"
            title="Negrita (**texto**)"
            aria-label="Agregar negrita"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={disabled || activeTab === 'preview'}
            onClick={handleAddList}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/80 rounded transition-colors disabled:opacity-40 cursor-pointer"
            title="Lista (- item)"
            aria-label="Agregar lista"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={disabled || activeTab === 'preview'}
            onClick={handleAddLink}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/80 rounded transition-colors disabled:opacity-40 cursor-pointer"
            title="Insertar enlace ([texto](url))"
            aria-label="Insertar enlace"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={disabled || !value || value.length === 0}
            onClick={() => {
              onChange('');
              setActiveTab('write');
              textareaRef.current?.focus();
            }}
            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-red-600 disabled:cursor-not-allowed cursor-pointer ml-1"
            title="Vaciar editor"
            aria-label="Vaciar editor"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Toggle: Escribir | Vista previa */}
        <div className="flex items-center gap-1 bg-neutral-200/60 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'write'
                ? 'bg-white text-[#123E59] shadow-2xs font-bold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Escribir</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-white text-[#123E59] shadow-2xs font-bold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Vista previa</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {activeTab === 'write' ? (
        <textarea
          ref={textareaRef}
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={6}
          className="w-full p-3.5 text-sm font-normal text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden resize-y min-h-[140px] leading-relaxed"
        />
      ) : (
        <div className="p-4 min-h-[140px] bg-neutral-50/50">
          {value.trim() ? (
            <div className="space-y-1">
              {renderRichText(value)}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 italic">No hay contenido para previsualizar.</p>
          )}
        </div>
      )}
    </div>
  );
};

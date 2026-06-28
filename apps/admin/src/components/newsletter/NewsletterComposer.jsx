import React, { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Color } from '@tiptap/extension-text-style';

// ── Toolbar button ────────────────────────────────────────────────────
const ToolBtn = ({ onClick, active, title, children, danger }) => (
  <button
    type="button"
    onMouseDown={e => { e.preventDefault(); onClick(); }}
    title={title}
    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all shrink-0
      ${active
        ? 'bg-primary text-white shadow-sm'
        : danger
          ? 'text-red-500 hover:bg-red-50'
          : 'text-on-surface-variant/70 hover:bg-surface-container-high hover:text-on-surface'
      }`}
  >
    {children}
  </button>
);
const Divider = () => <div className="w-px h-5 bg-outline-variant/30 mx-1 shrink-0" />;

// ── Link dialog ───────────────────────────────────────────────────────
function LinkDialog({ onConfirm, onCancel, initial = '' }) {
  const [url, setUrl] = useState(initial);
  const [label, setLabel] = useState('');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h4 className="font-bold text-on-surface mb-4">Insert Link</h4>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">URL</label>
            <input autoFocus value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://paychain.co.ke"
              className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">Link text (optional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Click here"
              className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-outline-variant/40 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low">Cancel</button>
          <button onClick={() => onConfirm(url.trim(), label.trim())}
            disabled={!url.trim()}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-md disabled:opacity-40">
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Image dialog ──────────────────────────────────────────────────────
function ImageDialog({ onConfirm, onCancel }) {
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h4 className="font-bold text-on-surface mb-4">Insert Image</h4>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">Image URL</label>
            <input autoFocus value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/image.png"
              className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">Alt text (optional)</label>
            <input value={alt} onChange={e => setAlt(e.target.value)}
              placeholder="Describe the image"
              className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
          </div>
          {url && <img src={url} alt={alt} className="w-full max-h-40 object-contain rounded-lg border border-outline-variant/20 mt-1" onError={e => e.target.style.display='none'} />}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-outline-variant/40 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low">Cancel</button>
          <button onClick={() => onConfirm(url.trim(), alt.trim())}
            disabled={!url.trim()}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-md disabled:opacity-40">
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main composer ─────────────────────────────────────────────────────
export default function NewsletterComposer({ subject, onSubject, activeCount, busy, error, done, onSend, onClose }) {
  const [showPreview, setShowPreview] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [imageDialog, setImageDialog] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      Image.configure({ inline: false, HTMLAttributes: { class: 'max-w-full rounded-lg my-2' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Color,
      Placeholder.configure({ placeholder: 'Write your newsletter here…' }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[260px] px-5 py-4 focus:outline-none text-on-surface',
      },
    },
  });

  const html = editor?.getHTML() ?? '';
  const textLen = editor?.getText()?.length ?? 0;
  const canSend = subject.trim().length >= 3 && textLen >= 10 && activeCount > 0;

  const insertLink = useCallback((url, label) => {
    if (!editor) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    if (label) {
      editor.chain().focus().insertContent(`<a href="${fullUrl}">${label}</a>`).run();
    } else {
      editor.chain().focus().setLink({ href: fullUrl }).run();
    }
    setLinkDialog(false);
  }, [editor]);

  const insertImage = useCallback((url, alt) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: url, alt }).run();
    setImageDialog(false);
  }, [editor]);

  if (done) {
    return (
      <ModalShell onClose={onClose} wide>
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">Campaign Sent!</h3>
          <p className="text-on-surface-variant text-sm mb-6">{done.message}</p>
          <button onClick={onClose} className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm uppercase tracking-widest hover:shadow-lg">
            Close
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <>
      <ModalShell onClose={busy ? undefined : onClose} wide>
        {/* Gmail-style header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#06201B] shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-lg">campaign</span>
            <span className="text-[13px] font-bold text-white">New Newsletter Campaign</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setShowPreview(p => !p)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${showPreview ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            <button onClick={busy ? undefined : onClose} disabled={busy}
              className="p-1 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
          {/* ── Left: compose pane ── */}
          <div className={`flex flex-col flex-1 min-h-0 ${showPreview ? 'hidden lg:flex lg:w-1/2' : 'flex'}`}>

            {/* To (read-only) */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-outline-variant/15 bg-surface-container-lowest/30 shrink-0">
              <span className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest w-12 shrink-0">To</span>
              <span className="text-[13px] text-on-surface-variant/70 font-medium">
                {activeCount} active subscriber{activeCount !== 1 ? 's' : ''}
                <span className="ml-2 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100">Verified list</span>
              </span>
            </div>

            {/* From (read-only) */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-outline-variant/15 bg-surface-container-lowest/30 shrink-0">
              <span className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest w-12 shrink-0">From</span>
              <span className="text-[13px] text-on-surface font-medium">PayChain Kenya <span className="text-on-surface-variant/50">&lt;info@paychain.co.ke&gt;</span></span>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3 px-5 py-2 border-b border-outline-variant/15 shrink-0">
              <span className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest w-12 shrink-0">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={e => onSubject(e.target.value)}
                maxLength={200}
                disabled={busy}
                placeholder="What's new at PayChain…"
                className="flex-1 text-[14px] text-on-surface font-medium py-2 outline-none bg-transparent placeholder-on-surface-variant/30 disabled:opacity-50"
              />
              <span className="text-[10px] text-on-surface-variant/30 shrink-0">{subject.length}/200</span>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-outline-variant/15 bg-surface-container-lowest/50 shrink-0">
              {/* Text style */}
              <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold"><strong>B</strong></ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic"><em>I</em></ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline"><span className="underline">U</span></ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough"><span className="line-through">S</span></ToolBtn>

              <Divider />

              {/* Headings */}
              <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1">
                <span className="text-[11px] font-black">H1</span>
              </ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">
                <span className="text-[11px] font-black">H2</span>
              </ToolBtn>

              <Divider />

              {/* Lists */}
              <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
                <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
              </ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered list">
                <span className="material-symbols-outlined text-[16px]">format_list_numbered</span>
              </ToolBtn>

              <Divider />

              {/* Alignment */}
              <ToolBtn onClick={() => editor?.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} title="Align left">
                <span className="material-symbols-outlined text-[16px]">format_align_left</span>
              </ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} title="Align center">
                <span className="material-symbols-outlined text-[16px]">format_align_center</span>
              </ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().setTextAlign('right').run()} active={editor?.isActive({ textAlign: 'right' })} title="Align right">
                <span className="material-symbols-outlined text-[16px]">format_align_right</span>
              </ToolBtn>

              <Divider />

              {/* Quote + Code */}
              <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">
                <span className="material-symbols-outlined text-[16px]">format_quote</span>
              </ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="Inline code">
                <span className="material-symbols-outlined text-[16px]">code</span>
              </ToolBtn>

              <Divider />

              {/* Link & Image */}
              <ToolBtn onClick={() => setLinkDialog(true)} active={editor?.isActive('link')} title="Insert link">
                <span className="material-symbols-outlined text-[16px]">link</span>
              </ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().unsetLink().run()} title="Remove link" danger>
                <span className="material-symbols-outlined text-[16px]">link_off</span>
              </ToolBtn>
              <ToolBtn onClick={() => setImageDialog(true)} title="Insert image">
                <span className="material-symbols-outlined text-[16px]">image</span>
              </ToolBtn>

              <Divider />

              {/* Undo / Redo */}
              <ToolBtn onClick={() => editor?.chain().focus().undo().run()} title="Undo">
                <span className="material-symbols-outlined text-[16px]">undo</span>
              </ToolBtn>
              <ToolBtn onClick={() => editor?.chain().focus().redo().run()} title="Redo">
                <span className="material-symbols-outlined text-[16px]">redo</span>
              </ToolBtn>

              <div className="ml-auto text-[10px] text-on-surface-variant/30 tabular-nums">{textLen} chars</div>
            </div>

            {/* Editor body */}
            <div className="flex-1 overflow-y-auto">
              <EditorContent editor={editor} />
            </div>

            {/* Error */}
            {error && (
              <div className="mx-5 mb-3 text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">
                {error}
              </div>
            )}
          </div>

          {/* ── Right / bottom: live preview pane ── */}
          {showPreview && (
            <div className="flex-1 border-l border-outline-variant/15 overflow-y-auto bg-[#f4f4f4] lg:w-1/2">
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-3 text-center">Email Preview</p>
                {/* Email chrome wrapper */}
                <div className="max-w-[560px] mx-auto bg-white rounded-2xl shadow-lg overflow-hidden text-[14px]">
                  <div className="bg-[#06201B] px-6 py-5 text-center">
                    <p className="text-[10px] font-bold tracking-[0.3em] text-emerald-300 uppercase mb-1">PayChain Kenya</p>
                    <h2 className="text-lg font-bold text-white">{subject || '(no subject)'}</h2>
                  </div>
                  <div
                    className="p-6 prose prose-sm max-w-none text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: html || '<p class="text-gray-400 italic">(empty — start writing in the editor)</p>' }}
                  />
                  <div className="border-t border-gray-100 px-6 py-4 text-center">
                    <p className="text-[11px] text-gray-400">You received this email because you subscribed to PayChain updates.</p>
                    <p className="text-[11px] text-gray-400 mt-1">© 2026 PayChain Kenya Ltd · <a href="#" className="underline">Unsubscribe</a></p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-outline-variant/15 bg-surface-container-lowest/50 shrink-0">
          <div className="flex items-center gap-2 text-[12px] text-on-surface-variant/50">
            <span className="material-symbols-outlined text-amber-500 text-base">info</span>
            <span>Sends <strong className="text-on-surface">{activeCount}</strong> emails via Resend.</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={busy}
              className="px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface text-[11px] font-bold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40">
              Cancel
            </button>
            <button
              onClick={() => onSend(html)}
              disabled={busy || !canSend}
              className="px-5 py-2 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {busy
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                : <><span className="material-symbols-outlined text-[14px]">send</span>Send to {activeCount}</>
              }
            </button>
          </div>
        </div>
      </ModalShell>

      {linkDialog  && <LinkDialog  onConfirm={insertLink}  onCancel={() => setLinkDialog(false)} />}
      {imageDialog && <ImageDialog onConfirm={insertImage} onCancel={() => setImageDialog(false)} />}
    </>
  );
}

const ModalShell = ({ onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm"
    onClick={onClose}>
    <div
      className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden ${wide ? 'max-w-5xl h-[90vh]' : 'max-w-lg'}`}
      style={{ maxHeight: '90vh' }}
      onClick={e => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

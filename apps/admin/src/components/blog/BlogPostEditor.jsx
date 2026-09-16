import React, { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';

// Rich-text editor for blog post bodies, used by BlogPosts.jsx. Standalone
// rather than reusing components/newsletter/NewsletterComposer.jsx (which is
// tightly coupled to the newsletter compose flow — subject line, {{name}}
// merge tags, campaign send) so that feature stays untouched. Same Tiptap
// extensions/toolbar shape as NewsletterComposer.jsx, image upload pointed
// at the blog endpoint instead.

const ToolBtn = ({ onClick, active, title, children, danger }) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
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

function LinkDialog({ onConfirm, onCancel, initial = '' }) {
  const [url, setUrl] = useState(initial);
  const [label, setLabel] = useState('');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-bold text-on-surface mb-4">Insert Link</h4>
        <div className="space-y-3">
          <div>
            <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">URL</label>
            <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://paychain.co.ke"
              className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
          </div>
          <div>
            <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1">Link text (optional)</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Click here"
              className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-outline-variant/40 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low">Cancel</button>
          <button onClick={() => onConfirm(url.trim(), label.trim())} disabled={!url.trim()}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-md disabled:opacity-40">
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageDialog({ onConfirm, onCancel }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploaded, setUploaded] = useState(null);
  const fileRef = React.useRef();
  const API = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

  function pickFile(f) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setError('File must be under 8 MB.'); return; }
    setFile(f);
    setError('');
    setUploaded(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const token = localStorage.getItem('paychain_admin_token');
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`${API}/api/blog/admin/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploaded(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-bold text-on-surface mb-4">Insert Image</h4>
        <div className="space-y-3">
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-primary bg-primary/5' : 'border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container-low'
            }`}
          >
            <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" className="hidden"
              onChange={(e) => pickFile(e.target.files[0])} />
            {preview ? (
              <img src={preview} alt="" className="max-h-36 mx-auto rounded-lg object-contain" />
            ) : (
              <>
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 block mb-2">upload_file</span>
                <p className="text-sm font-medium text-on-surface-variant/60">Drag &amp; drop an image here, or <span className="text-primary font-bold">browse</span></p>
                <p className="text-2xs text-on-surface-variant/40 mt-1">JPG, PNG, GIF, WebP · Max 8 MB</p>
              </>
            )}
          </div>

          {file && !uploaded && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
              <span className="font-medium text-on-surface truncate mr-2">{file.name}</span>
              <span className="text-on-surface-variant/50 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          )}
          {uploaded && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs">
              <span className="material-symbols-outlined text-emerald-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="text-emerald-800 font-medium">Uploaded · {uploaded.sizeKb} KB · {uploaded.width}×{uploaded.height}</span>
              <button type="button" onClick={() => { setFile(null); setPreview(''); setUploaded(null); }}
                className="ml-auto text-emerald-600 hover:text-emerald-800 font-bold">Change</button>
            </div>
          )}
          {!uploaded && file && (
            <button type="button" onClick={handleUpload} disabled={uploading}
              className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50">
              {uploading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading &amp; compressing…</>
                : <><span className="material-symbols-outlined text-base">cloud_upload</span>Upload</>
              }
            </button>
          )}
        </div>

        <div className="mt-3">
          <label className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 block mb-1.5">Alt text (optional)</label>
          <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image for accessibility"
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
        </div>

        {error && <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">{error}</p>}

        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-outline-variant/40 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low">Cancel</button>
          <button onClick={() => onConfirm(uploaded?.url, alt.trim())} disabled={!uploaded?.url}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-md disabled:opacity-40 flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-base">add_photo_alternate</span>
            Insert Image
          </button>
        </div>
      </div>
    </div>
  );
}

// `initialContent` seeds the editor once at mount — BlogPosts.jsx
// conditionally mounts this component per-post, so switching which post is
// being edited always remounts it fresh (see that file's `key={editing._id}`).
export default function BlogPostEditor({ initialContent, onChange }) {
  const [linkDialog, setLinkDialog] = useState(false);
  const [imageDialog, setImageDialog] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      Image.configure({ inline: false, HTMLAttributes: { style: 'max-width:100%;height:auto;display:block;margin:12px auto;border-radius:8px;' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Write the article…' }),
    ],
    content: initialContent || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[320px] px-5 py-4 focus:outline-none text-on-surface',
      },
    },
  });

  const insertLink = useCallback((url, label) => {
    if (!editor) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    if (label) editor.chain().focus().insertContent(`<a href="${fullUrl}">${label}</a>`).run();
    else editor.chain().focus().setLink({ href: fullUrl }).run();
    setLinkDialog(false);
  }, [editor]);

  const insertImage = useCallback((url, alt) => {
    if (!editor || !url) return;
    editor.chain().focus().setImage({ src: url, alt }).run();
    setImageDialog(false);
  }, [editor]);

  return (
    <>
      <div className="border border-outline-variant/30 rounded-xl overflow-hidden bg-white">
        <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-outline-variant/15 bg-surface-container-lowest/50">
          <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold"><strong>B</strong></ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic"><em>I</em></ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline"><span className="underline">U</span></ToolBtn>

          <Divider />

          <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">
            <span className="text-2xs font-black">H2</span>
          </ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="Heading 3">
            <span className="text-2xs font-black">H3</span>
          </ToolBtn>

          <Divider />

          <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
            <span className="material-symbols-outlined text-base">format_list_bulleted</span>
          </ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered list">
            <span className="material-symbols-outlined text-base">format_list_numbered</span>
          </ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">
            <span className="material-symbols-outlined text-base">format_quote</span>
          </ToolBtn>

          <Divider />

          <ToolBtn onClick={() => setLinkDialog(true)} active={editor?.isActive('link')} title="Insert link">
            <span className="material-symbols-outlined text-base">link</span>
          </ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().unsetLink().run()} title="Remove link" danger>
            <span className="material-symbols-outlined text-base">link_off</span>
          </ToolBtn>
          <ToolBtn onClick={() => setImageDialog(true)} title="Insert image">
            <span className="material-symbols-outlined text-base">image</span>
          </ToolBtn>

          <Divider />

          <ToolBtn onClick={() => editor?.chain().focus().undo().run()} title="Undo">
            <span className="material-symbols-outlined text-base">undo</span>
          </ToolBtn>
          <ToolBtn onClick={() => editor?.chain().focus().redo().run()} title="Redo">
            <span className="material-symbols-outlined text-base">redo</span>
          </ToolBtn>

          <div className="ml-auto text-2xs text-on-surface-variant/30 tabular-nums">{editor?.getText()?.length ?? 0} chars</div>
        </div>

        <EditorContent editor={editor} />
      </div>

      {linkDialog && <LinkDialog onConfirm={insertLink} onCancel={() => setLinkDialog(false)} />}
      {imageDialog && <ImageDialog onConfirm={insertImage} onCancel={() => setImageDialog(false)} />}
    </>
  );
}

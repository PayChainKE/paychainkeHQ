import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import TablePagination from '../components/ui/TablePagination';
import BlogPostEditor from '../components/blog/BlogPostEditor';

const PAGE_SIZE = 25;

const CATEGORIES = ['Company News', 'Compliance', 'Industry Insights', 'Product Updates', 'Technology', 'Case Studies'];

const STATUS_META = {
  published: { label: 'Published', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  draft: { label: 'Draft', pill: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-500' },
};

const STATUS_FILTERS = [
  { id: 'all', label: 'All', icon: 'article' },
  { id: 'published', label: 'Published', icon: 'public' },
  { id: 'draft', label: 'Drafts', icon: 'edit_note' },
];

function slugify(str) {
  return String(str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function blankDraft() {
  return {
    _id: null,
    title: '',
    slug: '',
    slugTouched: false,
    excerpt: '',
    category: CATEGORIES[0],
    content: '',
    image: '',
    author: { name: '', role: '', avatar: '' },
    readTime: '',
    featured: false,
    status: 'draft',
  };
}

const BlogPosts = () => {
  const { admin } = useAuth();
  const canMutate = admin?.role === 'owner' || admin?.role === 'admin';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // full draft object, or null
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteState, setDeleteState] = useState(null); // { post, busy } | null
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/blog/admin');
      if (res.data?.success) setPosts(res.data.data || []);
      else setError(res.data?.error || 'Could not load posts.');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load posts.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const filtered = useMemo(() => posts.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.title.toLowerCase().includes(s) || p.slug.toLowerCase().includes(s);
    }
    return true;
  }), [posts, statusFilter, search]);

  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const pagedPosts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const stats = useMemo(() => ({
    total: posts.length,
    published: posts.filter((p) => p.status === 'published').length,
    draft: posts.filter((p) => p.status === 'draft').length,
  }), [posts]);

  async function openEdit(post) {
    // List rows don't carry `content` (kept out of the list payload to stay
    // light) — fetch the full document when opening the editor.
    try {
      const res = await api.get(`/api/blog/admin/${post._id}`);
      if (res.data?.success) {
        const p = res.data.data;
        setEditing({ ...p, slugTouched: true, author: p.author || { name: '', role: '', avatar: '' } });
      } else showToast(res.data?.error || 'Could not load post.');
    } catch (e) {
      showToast(e?.response?.data?.error || 'Could not load post.');
    }
  }

  function openCreate() {
    setEditing(blankDraft());
  }

  async function handleSave(status) {
    if (!editing.title.trim()) { setSaveError('Title is required.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        title: editing.title,
        slug: editing.slug,
        excerpt: editing.excerpt,
        category: editing.category,
        content: editing.content,
        image: editing.image,
        author: editing.author,
        readTime: editing.readTime,
        featured: editing.featured,
        status,
      };
      const res = editing._id
        ? await api.put(`/api/blog/admin/${editing._id}`, payload)
        : await api.post('/api/blog/admin', payload);
      if (res.data?.success) {
        showToast(status === 'published' ? 'Published.' : 'Saved as draft.');
        setEditing(null);
        fetchPosts();
      } else setSaveError(res.data?.error || 'Could not save.');
    } catch (e) {
      setSaveError(e?.response?.data?.error || 'Could not save.');
    } finally { setSaving(false); }
  }

  async function handleDelete(post) {
    setDeleteState({ post, busy: true });
    try {
      const res = await api.delete(`/api/blog/admin/${post._id}`);
      if (res.data?.success) {
        setPosts((arr) => arr.filter((p) => p._id !== post._id));
        setDeleteState(null);
        showToast('Post deleted.');
      } else { setDeleteState({ post, busy: false }); showToast(res.data?.error || 'Could not delete.'); }
    } catch (e) {
      setDeleteState({ post, busy: false });
      showToast(e?.response?.data?.error || 'Could not delete.');
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#06201B] via-[#0a3029] to-[#0f3a30] border border-emerald-900/40 shadow-[0_30px_80px_-20px_rgba(6,32,27,0.5)] p-5 md:p-8">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300">Marketing Content</p>
              </div>
              <h1 className="text-2xl md:text-5xl font-bold text-white tracking-tighter font-headline leading-none">Blog Posts</h1>
              <p className="text-emerald-100/60 mt-2 max-w-xl text-xs md:text-sm">
                Publish and edit articles on the marketing site's Blog — no code changes or deploys needed.
              </p>
            </div>
            {canMutate && (
              <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-2xs font-bold rounded-xl uppercase tracking-widest transition-all shadow-lg">
                <span className="material-symbols-outlined text-base">add</span>
                New Post
              </button>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon="article" label="Total Posts" value={stats.total} />
          <StatTile icon="public" label="Published" value={stats.published} tone="emerald" />
          <StatTile icon="edit_note" label="Drafts" value={stats.draft} tone="amber" />
        </div>

        {/* Filters / search */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-editorial">
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map((sf) => (
                <button key={sf.id} onClick={() => setStatusFilter(sf.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-2xs font-bold uppercase tracking-widest border transition-all ${
                    statusFilter === sf.id ? 'bg-primary text-white border-primary shadow' : 'bg-white text-on-surface-variant/70 border-outline-variant/30 hover:border-primary hover:text-primary'
                  }`}>
                  <span className="material-symbols-outlined text-sm">{sf.icon}</span>
                  {sf.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or slug"
                className="w-full pl-9 pr-3 py-2 bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-xs" />
            </div>
          </div>
        </div>

        {/* List — desktop */}
        <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant/10 bg-white">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-0.5">All Posts</p>
            <h3 className="text-base font-bold text-on-surface tracking-tight">{filtered.length} post{filtered.length === 1 ? '' : 's'}</h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <Th>Post</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th className="text-center">Featured</Th>
                  <Th>Updated</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant/40 text-sm">{error || 'No posts match this view.'}</td></tr>
                ) : pagedPosts.map((p) => (
                  <PostRow key={p._id} post={p} canMutate={canMutate} onEdit={() => openEdit(p)} onDelete={() => setDeleteState({ post: p, busy: false })} />
                ))}
              </tbody>
            </table>
          </div>
          {!loading && <TablePagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />}
        </div>

        {/* List — mobile */}
        <div className="md:hidden space-y-2">
          {loading ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">Loading posts…</div> :
            filtered.length === 0 ? <div className="p-8 text-center text-on-surface-variant/40 text-sm">{error || 'No posts match this view.'}</div> :
            pagedPosts.map((p) => (
              <PostCard key={p._id} post={p} onEdit={() => openEdit(p)} />
            ))}
          {!loading && filtered.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-editorial overflow-hidden">
              <TablePagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
            </div>
          )}
        </div>

        {/* Editor drawer */}
        {editing && (
          <EditorDrawer
            key={editing._id || 'new'}
            draft={editing}
            setDraft={setEditing}
            onClose={() => setEditing(null)}
            onSave={handleSave}
            saving={saving}
            saveError={saveError}
          />
        )}

        {/* Delete confirm */}
        {deleteState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !deleteState.busy && setDeleteState(null)}>
            <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-on-surface mb-2">Delete "{deleteState.post.title}"?</h3>
              <p className="text-sm text-on-surface-variant/70 mb-5">This cannot be undone. The post will disappear from the marketing site immediately.</p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setDeleteState(null)} disabled={deleteState.busy} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low transition-all">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteState.post)} disabled={deleteState.busy} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-2xs font-bold uppercase tracking-widest transition-all disabled:opacity-50">
                  {deleteState.busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface-container-lowest px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-fadeIn">{toast}</div>
        )}
      </div>
    </Layout>
  );
};

// ── Editor drawer ───────────────────────────────────────────────────
const EditorDrawer = ({ draft, setDraft, onClose, onSave, saving, saveError }) => {
  function patch(fields) { setDraft((d) => ({ ...d, ...fields })); }
  function patchAuthor(fields) { setDraft((d) => ({ ...d, author: { ...d.author, ...fields } })); }

  function onTitleChange(title) {
    patch({ title, slug: draft.slugTouched ? draft.slug : slugify(title) });
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose}></div>
      <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-gradient-to-br from-[#06201B] to-[#0a3029] p-6 text-white">
          <button onClick={saving ? undefined : onClose} className="absolute top-4 right-4 text-white/60 hover:text-white p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-1">{draft._id ? 'Edit Post' : 'New Post'}</p>
          <h3 className="text-xl font-bold tracking-tight">{draft.title || 'Untitled post'}</h3>
          {draft._id && <p className="text-xs text-emerald-100/60 mt-1">/blog/{draft.slug}</p>}
        </div>

        <div className="p-6 space-y-5">
          <Field label="Title" required>
            <input type="text" value={draft.title} onChange={(e) => onTitleChange(e.target.value)} maxLength={200} className={inputClass} />
          </Field>

          <Field label="Slug" hint="The URL path: paychain.co.ke/blog/your-slug">
            <input type="text" value={draft.slug} onChange={(e) => { patch({ slug: slugify(e.target.value), slugTouched: true }); }} className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select value={draft.category} onChange={(e) => patch({ category: e.target.value })} className={selectClass}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Read time" hint="Optional, e.g. '4 min read'">
              <input type="text" value={draft.readTime} onChange={(e) => patch({ readTime: e.target.value })} maxLength={40} className={inputClass} />
            </Field>
          </div>

          <Field label="Excerpt" hint="Short teaser shown on the Blog index card and used as the search-engine description.">
            <textarea value={draft.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} maxLength={300} rows={3} className={inputClass} />
          </Field>

          <Field label="Cover image URL" hint="Use the editor's image button below to upload one, then paste its URL here — or paste any image URL directly.">
            <input type="text" value={draft.image} onChange={(e) => patch({ image: e.target.value })} className={inputClass} placeholder="https://res.cloudinary.com/…" />
            {draft.image && <img src={draft.image} alt="" className="mt-2 max-h-32 rounded-lg object-cover border border-outline-variant/20" onError={(e) => { e.target.style.display = 'none'; }} />}
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Author name">
              <input type="text" value={draft.author.name} onChange={(e) => patchAuthor({ name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Author role">
              <input type="text" value={draft.author.role} onChange={(e) => patchAuthor({ role: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Author avatar URL">
              <input type="text" value={draft.author.avatar} onChange={(e) => patchAuthor({ avatar: e.target.value })} className={inputClass} />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={draft.featured} onChange={(e) => patch({ featured: e.target.checked })} className="w-4 h-4 accent-primary" />
            <span className="text-xs font-bold text-on-surface">Feature this post</span>
            <span className="text-2xs text-on-surface-variant/50">(shows it highlighted at the top of the Blog index — only one post can be featured at a time)</span>
          </label>

          <Field label="Content">
            <BlogPostEditor initialContent={draft.content} onChange={(html) => patch({ content: html })} />
          </Field>

          {saveError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{saveError}</div>}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/10">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low transition-all disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => onSave('draft')} disabled={saving} className="px-5 py-2 rounded-lg border border-outline-variant/40 text-on-surface text-2xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">save</span>
              Save Draft
            </button>
            <button type="button" onClick={() => onSave('published')} disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">publish</span>
              {saving ? 'Saving…' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Atoms ───────────────────────────────────────────────────────────
const inputClass = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none';
const selectClass = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-xs font-bold bg-white';

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-2xs text-on-surface-variant/50 mt-1">{hint}</p>}
  </div>
);

const Th = ({ children, className = '' }) => (
  <th className={`px-3 py-2 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 ${className}`}>{children}</th>
);

const SkeletonRow = () => (
  <tr>
    <td colSpan={6} className="px-3 py-2.5 border-b border-outline-variant/5">
      <div className="h-6 bg-surface-container-low rounded animate-pulse"></div>
    </td>
  </tr>
);

const PostRow = ({ post, canMutate, onEdit, onDelete }) => {
  const statusStyle = STATUS_META[post.status] || STATUS_META.draft;
  return (
    <tr className="hover:bg-secondary-container/5 transition-colors group">
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <div className="flex items-center gap-2.5">
          {post.image
            ? <img src={post.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            : <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center flex-shrink-0"><span className="material-symbols-outlined text-on-surface-variant/30 text-lg">image</span></div>}
          <div className="min-w-0">
            <p className="font-bold text-on-surface tracking-tight text-xs truncate max-w-xs">{post.title}</p>
            <p className="text-2xs text-on-surface-variant/50 truncate max-w-xs">/blog/{post.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-2xs text-on-surface-variant/70">{post.category}</td>
      <td className="px-3 py-2 border-b border-outline-variant/5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
          {statusStyle.label}
        </span>
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-center">
        {post.featured && <span className="material-symbols-outlined text-amber-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-2xs text-on-surface-variant/50">
        {post.updatedAt ? new Date(post.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-3 py-2 border-b border-outline-variant/5 text-right">
        <div className="flex items-center justify-end gap-1">
          <button onClick={onEdit} className="text-on-surface-variant/40 hover:text-primary transition-all p-1">
            <span className="material-symbols-outlined text-lg">{canMutate ? 'edit' : 'visibility'}</span>
          </button>
          {canMutate && (
            <button onClick={onDelete} className="text-on-surface-variant/40 hover:text-red-600 transition-all p-1">
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

const PostCard = ({ post, onEdit }) => {
  const statusStyle = STATUS_META[post.status] || STATUS_META.draft;
  return (
    <button onClick={onEdit} className="w-full text-left bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        {post.image
          ? <img src={post.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center flex-shrink-0"><span className="material-symbols-outlined text-on-surface-variant/30 text-lg">image</span></div>}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-xs">{post.title}{post.featured && <span className="material-symbols-outlined text-amber-500 text-sm ml-1 align-middle" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}</p>
          <p className="text-2xs text-on-surface-variant/60 truncate">/blog/{post.slug}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
              {statusStyle.label}
            </span>
            <span className="text-2xs text-on-surface-variant/50">{post.category}</span>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">chevron_right</span>
      </div>
    </button>
  );
};

const StatTile = ({ icon, label, value, tone }) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneMap[tone] || 'bg-surface-container text-on-surface-variant/70'}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <span className="text-2xl font-bold text-on-surface tracking-tighter tabular-nums">{value}</span>
    </div>
  );
};

export default BlogPosts;

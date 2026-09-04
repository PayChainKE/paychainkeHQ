import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useNotification } from '../context/NotificationContext'
import { getAppUrl } from '../utils/appUrl'
import { formatKES } from '../utils/formatCurrency'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const blankItem = () => ({ name: '', unitPrice: '', description: '', stockLimit: '' })

// Management screen for Checkout Pages — a merchant-owned, reusable, multi-
// product catalog. Distinct from a Payment Link (RequestMoney.jsx): a
// Checkout Page never has a fixed amount. A customer opening the embed
// button (data-paychain-checkout) picks products/quantities on
// CartCheckoutPage.jsx, and only once they finalize their cart does the
// backend mint an ordinary, single-use PaymentLink for that computed total —
// see backend/controllers/transactionController.js's checkoutPageCheckout.
export default function CheckoutPages() {
  const { addNotification } = useNotification()

  const [pages, setPages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedEmbedFor, setExpandedEmbedFor] = useState(null)

  const [showModal, setShowModal] = useState(false)
  const [editingPageId, setEditingPageId] = useState(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCollectBuyerName, setFormCollectBuyerName] = useState(false)
  const [formItems, setFormItems] = useState([blankItem()])
  const [isSaving, setIsSaving] = useState(false)

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('paychain_merchant_token')}`
  })

  const fetchPages = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await axios.get(`${API_URL}/api/transactions/checkout-page`, { headers: authHeaders() })
      if (res.data.success) setPages(res.data.pages)
    } catch (err) {
      addNotification({ title: 'Could Not Load', message: 'Failed to load your checkout pages.', type: 'error' })
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchPages() }, [fetchPages])

  const openCreateModal = () => {
    setEditingPageId(null)
    setFormTitle('')
    setFormDescription('')
    setFormCollectBuyerName(false)
    setFormItems([blankItem()])
    setShowModal(true)
  }

  const openEditModal = (page) => {
    setEditingPageId(page.pageId)
    setFormTitle(page.title)
    setFormDescription(page.description || '')
    setFormCollectBuyerName(!!page.collectBuyerName)
    setFormItems(page.items.map((i) => ({
      itemId: i.itemId,
      name: i.name,
      unitPrice: String(i.unitPrice),
      description: i.description || '',
      stockLimit: i.stockLimit == null ? '' : String(i.stockLimit),
    })))
    setShowModal(true)
  }

  const updateItemField = (index, field, value) => {
    setFormItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const addItemRow = () => setFormItems((prev) => [...prev, blankItem()])
  const removeItemRow = (index) => setFormItems((prev) => prev.filter((_, i) => i !== index))

  const handleSave = async () => {
    if (!formTitle.trim()) {
      addNotification({ title: 'Title Required', message: 'Give your checkout page a name.', type: 'error' })
      return
    }
    const cleanItems = formItems
      .map((item) => ({ ...item, name: item.name.trim() }))
      .filter((item) => item.name)
    if (cleanItems.length === 0) {
      addNotification({ title: 'Add a Product', message: 'Add at least one product with a name and price.', type: 'error' })
      return
    }
    for (const item of cleanItems) {
      if (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 1) {
        addNotification({ title: 'Invalid Price', message: `Enter a valid price for "${item.name}".`, type: 'error' })
        return
      }
      if (item.stockLimit !== '' && item.stockLimit != null) {
        const limit = Number(item.stockLimit)
        if (!Number.isInteger(limit) || limit < 1) {
          addNotification({ title: 'Invalid Stock Limit', message: `Stock limit for "${item.name}" must be a whole number of 1 or more, or left blank for unlimited.`, type: 'error' })
          return
        }
      }
    }

    setIsSaving(true)
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        collectBuyerName: formCollectBuyerName,
        items: cleanItems.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          unitPrice: Number(item.unitPrice),
          description: item.description.trim(),
          stockLimit: item.stockLimit === '' ? null : Number(item.stockLimit),
        })),
      }
      if (editingPageId) {
        await axios.patch(`${API_URL}/api/transactions/checkout-page/${editingPageId}`, payload, { headers: authHeaders() })
        addNotification({ title: 'Saved', message: 'Checkout page updated.', type: 'success' })
      } else {
        await axios.post(`${API_URL}/api/transactions/checkout-page`, payload, { headers: authHeaders() })
        addNotification({ title: 'Created', message: 'Your checkout page is live.', type: 'success' })
      }
      setShowModal(false)
      fetchPages()
    } catch (err) {
      addNotification({ title: 'Save Failed', message: err.response?.data?.error || 'Could not save checkout page.', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleActive = async (page) => {
    try {
      await axios.patch(`${API_URL}/api/transactions/checkout-page/${page.pageId}`, { active: !page.active }, { headers: authHeaders() })
      setPages((prev) => prev.map((p) => (p.pageId === page.pageId ? { ...p, active: !p.active } : p)))
    } catch (err) {
      addNotification({ title: 'Update Failed', message: 'Could not change page status.', type: 'error' })
    }
  }

  return (
    <MerchantLayout title="Checkout Pages">
      <div className="max-w-4xl mx-auto animate-fade-in-up">
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-headline text-2xl text-on-surface mb-1">Checkout Pages</h1>
            <p className="text-sm text-on-surface-variant max-w-lg">
              List multiple products with their own prices. Embed one button on your website and let customers pick what they want, see a real cart total, and pay — no fixed amount, no developer needed.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="shrink-0 flex items-center gap-2 px-5 py-3 bg-[#00351D] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl"
          >
            <span className="material-symbols-outlined text-lg">add</span> New Page
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : pages.length === 0 ? (
          <div className="bg-white rounded-[32px] border border-outline-variant/10 p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary mb-5">
              <span className="material-symbols-outlined text-3xl">storefront</span>
            </div>
            <h3 className="font-headline text-xl text-on-surface mb-2">No checkout pages yet</h3>
            <p className="text-sm text-on-surface-variant mb-6 max-w-sm mx-auto">Create one to start selling multiple products through a single embedded button.</p>
            <button onClick={openCreateModal} className="px-6 py-3 bg-[#00351D] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all">
              Create Your First Page
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {pages.map((page) => (
              <CheckoutPageCard
                key={page.pageId}
                page={page}
                isEmbedOpen={expandedEmbedFor === page.pageId}
                onToggleEmbed={() => setExpandedEmbedFor((cur) => (cur === page.pageId ? null : page.pageId))}
                onEdit={() => openEditModal(page)}
                onToggleActive={() => toggleActive(page)}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 md:p-8 border-b border-surface-container flex items-center justify-between">
              <h2 className="font-headline text-xl text-on-surface">{editingPageId ? 'Edit Checkout Page' : 'New Checkout Page'}</h2>
              <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Page Title</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Amina's Flower Shop"
                  className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3.5 px-4 text-base font-semibold text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Description (optional)</label>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="A short line customers see at checkout"
                  className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3.5 px-4 text-sm text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
                />
              </div>

              <label className="flex items-start gap-3 p-4 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={formCollectBuyerName}
                  onChange={(e) => setFormCollectBuyerName(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-bold text-on-surface">Collect the buyer's name at checkout</span>
                  <span className="block text-xs text-on-surface-variant mt-0.5">Useful for tickets/registrations where you need to know who paid, not just their phone number.</span>
                </span>
              </label>

              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Products</label>
                {formItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-2">
                      <input
                        value={item.name}
                        onChange={(e) => updateItemField(index, 'name', e.target.value)}
                        placeholder="Product name"
                        className="w-full bg-white border border-outline-variant/10 rounded-lg py-2.5 px-3 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary outline-none"
                      />
                      <input
                        value={item.unitPrice}
                        onChange={(e) => updateItemField(index, 'unitPrice', e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="Price (KES)"
                        inputMode="decimal"
                        className="w-full bg-white border border-outline-variant/10 rounded-lg py-2.5 px-3 text-sm font-medium tabular-nums text-on-surface focus:ring-2 focus:ring-primary outline-none"
                      />
                      <input
                        value={item.stockLimit}
                        onChange={(e) => updateItemField(index, 'stockLimit', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Stock limit (blank = unlimited)"
                        inputMode="numeric"
                        className="w-full bg-white border border-outline-variant/10 rounded-lg py-2.5 px-3 text-sm font-medium tabular-nums text-on-surface focus:ring-2 focus:ring-primary outline-none"
                      />
                      <input
                        value={item.description}
                        onChange={(e) => updateItemField(index, 'description', e.target.value)}
                        placeholder="Short description (optional)"
                        className="w-full bg-white border border-outline-variant/10 rounded-lg py-2.5 px-3 text-xs text-on-surface-variant focus:ring-2 focus:ring-primary outline-none sm:col-span-3"
                      />
                    </div>
                    <button
                      onClick={() => removeItemRow(index)}
                      disabled={formItems.length === 1}
                      className="mt-1 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error disabled:opacity-30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addItemRow}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span> Add another product
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8 border-t border-surface-container flex items-center justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-5 py-3 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container rounded-xl transition-all">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 bg-[#00351D] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-xl"
              >
                {isSaving ? 'Saving...' : editingPageId ? 'Save Changes' : 'Create Page'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MerchantLayout>
  )
}

function CheckoutPageCard({ page, isEmbedOpen, onToggleEmbed, onEdit, onToggleActive }) {
  const embedPreviewRef = useRef(null)

  const embedSnippet = `<script src="${getAppUrl()}/paychain-button.js" defer></script>\n<div data-paychain-checkout="${page.pageId}" data-paychain-label="Shop ${page.title}"></div>`

  const copyEmbedSnippet = () => {
    navigator.clipboard.writeText(embedSnippet)
  }

  useEffect(() => {
    if (!isEmbedOpen) return
    const renderPreview = () => window.PayChainEmbed?.scan()
    if (window.PayChainEmbed) {
      renderPreview()
      return
    }
    const existing = document.querySelector('script[data-paychain-embed-loader]')
    if (existing) {
      existing.addEventListener('load', renderPreview, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = `${getAppUrl()}/paychain-button.js`
    script.defer = true
    script.setAttribute('data-paychain-embed-loader', 'true')
    script.addEventListener('load', renderPreview, { once: true })
    document.body.appendChild(script)
  }, [isEmbedOpen])

  return (
    <div className="bg-white rounded-[28px] border border-outline-variant/10 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${page.active ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-2xl">storefront</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-lg text-on-surface truncate">{page.title}</h3>
              {!page.active && (
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">Paused</span>
              )}
              {page.collectBuyerName && (
                <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">Collects name</span>
              )}
            </div>
            {page.description && <p className="text-sm text-on-surface-variant truncate max-w-md">{page.description}</p>}
            <p className="text-xs text-on-surface-variant/70 mt-1">
              {page.items.length} product{page.items.length === 1 ? '' : 's'} · {formatKES(Math.min(...page.items.map((i) => i.unitPrice)))} – {formatKES(Math.max(...page.items.map((i) => i.unitPrice)))}
            </p>
            {page.items.some((i) => i.stockLimit != null) && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                {page.items.filter((i) => i.stockLimit != null).map((i) => (
                  <span key={i.itemId} className={`text-[10px] font-bold ${i.remaining === 0 ? 'text-error' : 'text-on-surface-variant/70'}`}>
                    {i.name}: {i.remaining === 0 ? 'Sold out' : `${i.sold} sold · ${i.remaining} left`}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onToggleActive} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">
            {page.active ? 'Pause' : 'Resume'}
          </button>
          <button onClick={onEdit} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-lg transition-colors">
            Edit
          </button>
          <button onClick={onToggleEmbed} className="px-4 py-2 bg-[#00351D] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
            {isEmbedOpen ? 'Hide Embed' : 'Get Embed Code'}
          </button>
        </div>
      </div>

      {isEmbedOpen && (
        <div className="mt-5 text-left bg-[#00351D] rounded-2xl p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#5EFEB3] mb-1">Embed on your website</p>
          <p className="text-emerald-100/60 text-xs mb-4 leading-relaxed">
            Paste this into a "Custom HTML"/"Embed" block on Wix, Shopify, WordPress, Squarespace, or any page builder. Customers pick products, see a cart total, and pay — no fixed amount.
          </p>
          <pre className="bg-black/30 rounded-xl p-4 text-emerald-100 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all mb-4">{embedSnippet}</pre>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={copyEmbedSnippet}
              className="px-5 py-2.5 bg-[#5EFEB3] text-[#00351D] rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-105 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">content_copy</span> Copy Snippet
            </button>
            <div className="flex items-center gap-2">
              <span className="text-emerald-100/50 text-[10px] font-bold uppercase tracking-widest">Live preview</span>
              <div ref={embedPreviewRef} data-paychain-checkout={page.pageId} data-paychain-label={`Shop ${page.title}`} data-paychain-theme="light" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, TicketPercent, Search, Plus, X, Pencil, Trash2, ChevronDown, Archive } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageContent from '../components/layout/PageContent'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import { useAccessDirectory } from '../hooks/useAccessDirectory'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '../components/ui/Table'

interface ProfileStoreRow {
  store_id: string | null
}

interface StoreCouponRow {
  id: string
  code: string
  description: string | null
  created_at: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  expires_at: string | null
  max_total_uses: number | null
  used_count: number
  is_active: boolean
}

type CouponSearchFieldFilter = 'all' | 'code' | 'description' | 'dateCreated' | 'expiryDate'

const COUPON_SEARCH_FIELD_OPTIONS: { value: CouponSearchFieldFilter; label: string }[] = [
  { value: 'all', label: 'All fields' },
  { value: 'code', label: 'Code' },
  { value: 'dateCreated', label: 'Date created' },
  { value: 'expiryDate', label: 'Expiry date' },
]

const COUPON_PAGE_SIZE = 10

export default function Coupons() {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const queryClient = useQueryClient()
  const { canAccess } = useAccessDirectory()
  const canWriteCoupons = !isSupabaseConfigured || canAccess('coupons.write')

  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<StoreCouponRow | null>(null)
  const [couponToDelete, setCouponToDelete] = useState<StoreCouponRow | null>(null)

  const [couponCode, setCouponCode] = useState('')
  const [couponDescription, setCouponDescription] = useState('')
  const [couponDiscountType, setCouponDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [couponDiscountValue, setCouponDiscountValue] = useState('')
  const [couponExpiresAt, setCouponExpiresAt] = useState('')
  const [couponMaxUses, setCouponMaxUses] = useState('')
  const [couponSearch, setCouponSearch] = useState('')
  const [searchFieldFilter, setSearchFieldFilter] = useState<CouponSearchFieldFilter>('all')
  const [archivedSearch, setArchivedSearch] = useState('')
  const [archivedSearchFieldFilter, setArchivedSearchFieldFilter] = useState<CouponSearchFieldFilter>('all')
  const [activePage, setActivePage] = useState(1)
  const [archivedPage, setArchivedPage] = useState(1)
  const [showArchived, setShowArchived] = useState(false)

  const discountAsNumber = Number(couponDiscountValue)
  const percentLimitExceeded =
    couponDiscountType === 'percent' &&
    couponDiscountValue.trim() !== '' &&
    Number.isFinite(discountAsNumber) &&
    discountAsNumber > 100

  const profileQuery = useQuery({
    queryKey: ['coupons-profile-store', user?.id],
    enabled: Boolean(isSupabaseConfigured && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user!.id)
        .single<ProfileStoreRow>()
      if (error) throw error
      return data
    },
  })

  const storeId = profileQuery.data?.store_id ?? null

  const couponsQuery = useQuery({
    queryKey: ['settings-coupons', storeId],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_coupons')
        .select('id, code, description, created_at, discount_type, discount_value, expires_at, max_total_uses, used_count, is_active')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as StoreCouponRow[]
    },
  })

  function resetCouponForm() {
    setShowForm(false)
    setEditingCoupon(null)
    setCouponCode('')
    setCouponDescription('')
    setCouponDiscountType('percent')
    setCouponDiscountValue('')
    setCouponExpiresAt('')
    setCouponMaxUses('')
  }

  function openCreateForm() {
    if (!canWriteCoupons) {
      showError('Read-only access: you cannot create coupons.')
      return
    }
    setEditingCoupon(null)
    setCouponCode('')
    setCouponDescription('')
    setCouponDiscountType('percent')
    setCouponDiscountValue('')
    setCouponExpiresAt('')
    setCouponMaxUses('')
    setShowForm(true)
  }

  function openEditForm(coupon: StoreCouponRow) {
    if (!canWriteCoupons) {
      showError('Read-only access: you cannot edit coupons.')
      return
    }
    setEditingCoupon(coupon)
    setCouponCode(coupon.code)
    setCouponDescription(coupon.description ?? '')
    setCouponDiscountType(coupon.discount_type)
    setCouponDiscountValue(String(coupon.discount_value))
    setCouponExpiresAt(coupon.expires_at ? coupon.expires_at.slice(0, 10) : '')
    setCouponMaxUses(coupon.max_total_uses != null ? String(coupon.max_total_uses) : '')
    setShowForm(true)
  }

  const createCouponMutation = useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      if (!storeId) throw new Error('Save your store first before creating coupons.')

      const code = couponCode.trim().toUpperCase()
      if (!code) throw new Error('Coupon code is required.')
      if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
        throw new Error('Coupon code must be 3-24 characters and use only A-Z, 0-9, underscore, or dash.')
      }

      const discountValue = Number(couponDiscountValue)
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error('Discount value must be greater than 0.')
      }
      if (couponDiscountType === 'percent' && discountValue > 100) {
        throw new Error('Percent discount cannot be more than 100.')
      }

      const maxUses = couponMaxUses.trim() ? Number(couponMaxUses) : null
      if (maxUses != null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
        throw new Error('Max uses must be a whole number greater than 0.')
      }

      const expiresAtIso = couponExpiresAt
        ? new Date(`${couponExpiresAt}T23:59:59`).toISOString()
        : null

      const { error } = await supabase.from('store_coupons').insert([{
        store_id: storeId,
        code,
        description: couponDescription.trim() || null,
        discount_type: couponDiscountType,
        discount_value: discountValue,
        expires_at: expiresAtIso,
        max_total_uses: maxUses,
        is_active: true,
      }])

      if (error) {
        if (error.message.toLowerCase().includes('duplicate')) {
          throw new Error('That coupon code already exists for your store.')
        }
        throw error
      }
    },
    onSuccess: async () => {
      showSuccess('Coupon created successfully.')
      resetCouponForm()
      await queryClient.invalidateQueries({ queryKey: ['settings-coupons'] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to create coupon.')
    },
  })

  const updateCouponMutation = useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      if (!storeId) throw new Error('Store not found.')
      if (!editingCoupon) throw new Error('No coupon selected for update.')

      const code = couponCode.trim().toUpperCase()
      if (!code) throw new Error('Coupon code is required.')
      if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
        throw new Error('Coupon code must be 3-24 characters and use only A-Z, 0-9, underscore, or dash.')
      }

      const discountValue = Number(couponDiscountValue)
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error('Discount value must be greater than 0.')
      }
      if (couponDiscountType === 'percent' && discountValue > 100) {
        throw new Error('Percent discount cannot be more than 100.')
      }

      const maxUses = couponMaxUses.trim() ? Number(couponMaxUses) : null
      if (maxUses != null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
        throw new Error('Max uses must be a whole number greater than 0.')
      }

      const expiresAtIso = couponExpiresAt
        ? new Date(`${couponExpiresAt}T23:59:59`).toISOString()
        : null

      const { error } = await supabase
        .from('store_coupons')
        .update({
          code,
          description: couponDescription.trim() || null,
          discount_type: couponDiscountType,
          discount_value: discountValue,
          expires_at: expiresAtIso,
          max_total_uses: maxUses,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingCoupon.id)
        .eq('store_id', storeId)

      if (error) {
        if (error.message.toLowerCase().includes('duplicate')) {
          throw new Error('That coupon code already exists for your store.')
        }
        throw error
      }
    },
    onSuccess: async () => {
      showSuccess('Coupon updated successfully.')
      resetCouponForm()
      await queryClient.invalidateQueries({ queryKey: ['settings-coupons'] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to update coupon.')
    },
  })

  const deleteCouponMutation = useMutation({
    mutationFn: async (couponId: string) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      if (!storeId) throw new Error('Store not found.')

      const { error } = await supabase
        .from('store_coupons')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', couponId)
        .eq('store_id', storeId)
      if (error) throw error
    },
    onSuccess: async () => {
      showSuccess('Coupon archived (soft deleted).')
      setCouponToDelete(null)
      if (editingCoupon?.id) resetCouponForm()
      await queryClient.invalidateQueries({ queryKey: ['settings-coupons'] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to delete coupon.')
    },
  })

  const filterCouponsByField = (
    list: StoreCouponRow[],
    keywordRaw: string,
    field: CouponSearchFieldFilter,
  ) => {
    const keyword = keywordRaw.trim().toLowerCase()
    if (!keyword) return list
    return list.filter((coupon) => {
      const code = coupon.code.toLowerCase()
      const description = (coupon.description ?? '').toLowerCase()
      const dateCreated = new Date(coupon.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }).toLowerCase()
      const expiryDate = coupon.expires_at
        ? new Date(coupon.expires_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }).toLowerCase()
        : 'no expiry'
      if (field === 'code') return code.includes(keyword)
      if (field === 'description') return description.includes(keyword)
      if (field === 'dateCreated') return dateCreated.includes(keyword)
      if (field === 'expiryDate') return expiryDate.includes(keyword)
      return (
        code.includes(keyword) ||
        description.includes(keyword) ||
        dateCreated.includes(keyword) ||
        expiryDate.includes(keyword)
      )
    })
  }

  const filteredActiveCoupons = useMemo(
    () =>
      filterCouponsByField(
        (couponsQuery.data ?? []).filter((coupon) => coupon.is_active),
        couponSearch,
        searchFieldFilter,
      ),
    [couponsQuery.data, couponSearch, searchFieldFilter],
  )

  const filteredArchivedCoupons = useMemo(
    () =>
      filterCouponsByField(
        (couponsQuery.data ?? []).filter((coupon) => !coupon.is_active),
        archivedSearch,
        archivedSearchFieldFilter,
      ),
    [couponsQuery.data, archivedSearch, archivedSearchFieldFilter],
  )

  const activeTotalPages = Math.ceil(filteredActiveCoupons.length / COUPON_PAGE_SIZE) || 1
  const archivedTotalPages = Math.ceil(filteredArchivedCoupons.length / COUPON_PAGE_SIZE) || 1

  const paginatedActiveCoupons = useMemo(
    () =>
      filteredActiveCoupons.slice(
        (activePage - 1) * COUPON_PAGE_SIZE,
        activePage * COUPON_PAGE_SIZE,
      ),
    [filteredActiveCoupons, activePage],
  )

  const paginatedArchivedCoupons = useMemo(
    () =>
      filteredArchivedCoupons.slice(
        (archivedPage - 1) * COUPON_PAGE_SIZE,
        archivedPage * COUPON_PAGE_SIZE,
      ),
    [filteredArchivedCoupons, archivedPage],
  )

  useEffect(() => {
    setActivePage(1)
  }, [couponSearch, searchFieldFilter])

  useEffect(() => {
    setArchivedPage(1)
  }, [archivedSearch, archivedSearchFieldFilter])

  useEffect(() => {
    if (activePage > activeTotalPages) setActivePage(Math.max(1, activeTotalPages))
  }, [activePage, activeTotalPages])

  useEffect(() => {
    if (archivedPage > archivedTotalPages) setArchivedPage(Math.max(1, archivedTotalPages))
  }, [archivedPage, archivedTotalPages])

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageContent className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TicketPercent size={24} className="text-slate-600" />
            <h1 className="text-xl font-bold text-slate-800">Coupons</h1>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            disabled={!isSupabaseConfigured || !storeId || !canWriteCoupons}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Add Coupon
          </button>
        </div>

        {showForm && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                {editingCoupon ? `Editing coupon: ${editingCoupon.code}` : 'Create a new coupon'}
              </p>
              <button
                type="button"
                onClick={resetCouponForm}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close coupon form"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Coupon code" value={couponCode} onChange={(v) => setCouponCode(v.toUpperCase())} placeholder="WELCOME10" />
              <Field label="Description (optional)" value={couponDescription} onChange={setCouponDescription} placeholder="10% off opening promo" />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Discount type</label>
                <Select value={couponDiscountType} onChange={(e) => setCouponDiscountType(e.target.value as 'percent' | 'fixed')}>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed amount (PHP)</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  {couponDiscountType === 'percent' ? 'Discount percent' : 'Discount amount (PHP)'}
                </label>
                <input
                  type="number"
                  value={couponDiscountValue}
                  onChange={(e) => setCouponDiscountValue(e.target.value)}
                  placeholder={couponDiscountType === 'percent' ? '10' : '100'}
                  className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 ${
                    percentLimitExceeded
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-slate-200 focus:ring-indigo-500'
                  }`}
                />
                {percentLimitExceeded && (
                  <p className="mt-1 text-xs text-red-600">100% is the maximum allowed discount.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Expiration date (optional)</label>
                <input
                  type="date"
                  value={couponExpiresAt}
                  onChange={(e) => setCouponExpiresAt(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <Field label="Max total uses (optional)" value={couponMaxUses} onChange={setCouponMaxUses} placeholder="100" type="number" />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  if (editingCoupon) {
                    updateCouponMutation.mutate()
                    return
                  }
                  createCouponMutation.mutate()
                }}
                disabled={
                  !canWriteCoupons ||
                  !couponCode.trim() ||
                  !couponDiscountValue.trim() ||
                  percentLimitExceeded ||
                  !isSupabaseConfigured
                }
                loading={createCouponMutation.isPending || updateCouponMutation.isPending}
              >
                {editingCoupon ? 'Update coupon' : 'Create coupon'}
              </Button>
            </div>
          </section>
        )}

        <section>
          <div className="space-y-4">
            <div className="flex items-center flex-wrap gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={couponSearch}
                  onChange={(e) => setCouponSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="coupon-search-field-filter" className="text-sm font-medium text-slate-600">
                  Filter by:
                </label>
                <Select
                  id="coupon-search-field-filter"
                  value={searchFieldFilter}
                  onChange={(e) => setSearchFieldFilter(e.target.value as CouponSearchFieldFilter)}
                  className="min-w-[130px]"
                >
                  {COUPON_SEARCH_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              {couponsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                  <Loader2 size={16} className="animate-spin" />
                  Loading…
                </div>
              ) : filteredActiveCoupons.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No coupons yet. Click Add Coupon to create one.</p>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableHeaderRow>
                          <TableHeaderCell>Code</TableHeaderCell>
                          <TableHeaderCell>Discount</TableHeaderCell>
                          <TableHeaderCell>Usage</TableHeaderCell>
                          <TableHeaderCell>Date Created</TableHeaderCell>
                          <TableHeaderCell>Expiry</TableHeaderCell>
                          <TableHeaderCell>Status</TableHeaderCell>
                          <TableHeaderCell className="text-center">Action</TableHeaderCell>
                        </TableHeaderRow>
                      </TableHead>
                      <TableBody>
                        {paginatedActiveCoupons.map((coupon) => {
                          const expiresText = coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('en-PH') : 'No expiry'
                          const usesText = coupon.max_total_uses != null ? `${coupon.used_count}/${coupon.max_total_uses}` : `${coupon.used_count}/∞`
                          return (
                            <TableRow key={coupon.id} className="last:border-b-0 hover:bg-slate-50 transition-colors">
                              <TableCell>
                                <p className="font-mono font-semibold text-slate-800">{coupon.code}</p>
                                {coupon.description && (
                                  <p className="text-xs text-slate-500 mt-0.5">{coupon.description}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                {coupon.discount_type === 'percent'
                                  ? `${coupon.discount_value}% off`
                                  : `PHP ${Number(coupon.discount_value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} off`}
                              </TableCell>
                              <TableCell className="text-slate-600">{usesText}</TableCell>
                              <TableCell className="text-slate-600">
                                {new Date(coupon.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                              </TableCell>
                              <TableCell className="text-slate-600">{expiresText}</TableCell>
                              <TableCell>
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${coupon.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {coupon.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditForm(coupon)}
                                    disabled={!canWriteCoupons}
                                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                  >
                                    <Pencil size={12} />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCouponToDelete(coupon)}
                                    disabled={!canWriteCoupons}
                                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={12} />
                                    Delete
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>
              )}
              {filteredActiveCoupons.length > COUPON_PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3 mt-3">
                  <p className="text-xs text-slate-500">
                    Showing {(activePage - 1) * COUPON_PAGE_SIZE + 1}–{Math.min(activePage * COUPON_PAGE_SIZE, filteredActiveCoupons.length)} of {filteredActiveCoupons.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                      disabled={activePage <= 1}
                      className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {activePage} of {activeTotalPages}</span>
                    <button
                      type="button"
                      onClick={() => setActivePage((p) => Math.min(activeTotalPages, p + 1))}
                      disabled={activePage >= activeTotalPages}
                      className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Archive size={15} className="text-slate-500" />
                  Archived coupons ({filteredArchivedCoupons.length})
                </span>
                <ChevronDown
                  size={18}
                  className={`text-slate-500 transition-transform duration-200 ${showArchived ? 'rotate-180' : ''}`}
                />
              </button>
              {showArchived && (
                <div className="px-4 pb-4">
                  <div className="flex items-center flex-wrap gap-3 mb-3">
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={archivedSearch}
                        onChange={(e) => setArchivedSearch(e.target.value)}
                        placeholder="Search archived..."
                        className="pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="archived-coupon-search-field-filter" className="text-sm font-medium text-slate-600">
                        Filter by:
                      </label>
                      <Select
                        id="archived-coupon-search-field-filter"
                        value={archivedSearchFieldFilter}
                        onChange={(e) => setArchivedSearchFieldFilter(e.target.value as CouponSearchFieldFilter)}
                        className="min-w-[130px]"
                      >
                        {COUPON_SEARCH_FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  {couponsQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                      <Loader2 size={14} className="animate-spin" />
                      Loading…
                    </div>
                  ) : filteredArchivedCoupons.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">No archived coupons.</p>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableHeaderRow>
                              <TableHeaderCell>Code</TableHeaderCell>
                              <TableHeaderCell>Discount</TableHeaderCell>
                              <TableHeaderCell>Usage</TableHeaderCell>
                              <TableHeaderCell>Date Created</TableHeaderCell>
                              <TableHeaderCell>Expiry</TableHeaderCell>
                              <TableHeaderCell>Status</TableHeaderCell>
                            </TableHeaderRow>
                          </TableHead>
                          <TableBody>
                            {paginatedArchivedCoupons.map((coupon) => {
                              const expiresText = coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('en-PH') : 'No expiry'
                              const usesText = coupon.max_total_uses != null ? `${coupon.used_count}/${coupon.max_total_uses}` : `${coupon.used_count}/∞`
                              return (
                                <TableRow key={coupon.id} className="last:border-b-0 hover:bg-slate-50 transition-colors">
                                  <TableCell>
                                    <p className="font-mono font-semibold text-slate-700">{coupon.code}</p>
                                    {coupon.description && (
                                      <p className="text-xs text-slate-500 mt-0.5">{coupon.description}</p>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {coupon.discount_type === 'percent'
                                      ? `${coupon.discount_value}% off`
                                      : `PHP ${Number(coupon.discount_value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} off`}
                                  </TableCell>
                                  <TableCell className="text-slate-600">{usesText}</TableCell>
                                  <TableCell className="text-slate-600">
                                    {new Date(coupon.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                                  </TableCell>
                                  <TableCell className="text-slate-600">{expiresText}</TableCell>
                                  <TableCell>
                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                      Archived
                                    </span>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </div>
                  )}
                  {filteredArchivedCoupons.length > COUPON_PAGE_SIZE && (
                    <div className="flex items-center justify-between gap-3 mt-3">
                      <p className="text-xs text-slate-500">
                        Showing {(archivedPage - 1) * COUPON_PAGE_SIZE + 1}–{Math.min(archivedPage * COUPON_PAGE_SIZE, filteredArchivedCoupons.length)} of {filteredArchivedCoupons.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setArchivedPage((p) => Math.max(1, p - 1))}
                          disabled={archivedPage <= 1}
                          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-slate-600">Page {archivedPage} of {archivedTotalPages}</span>
                        <button
                          type="button"
                          onClick={() => setArchivedPage((p) => Math.min(archivedTotalPages, p + 1))}
                          disabled={archivedPage >= archivedTotalPages}
                          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {couponToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Archive coupon</h3>
              <p className="text-sm text-slate-600">
                Are you sure you want to archive <span className="font-mono font-semibold">{couponToDelete.code}</span>?
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Soft delete keeps order history intact and removes this coupon from active use.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={() => setCouponToDelete(null)}
                  className="px-4 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  disabled={deleteCouponMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteCouponMutation.mutate(couponToDelete.id)}
                  className="px-4 py-2.5 text-sm rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-60"
                  disabled={deleteCouponMutation.isPending || !canWriteCoupons}
                >
                  {deleteCouponMutation.isPending ? 'Archiving...' : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { deleteInspiration } from '../lib/inspirationsApi'

export function DeleteConfirmPage() {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancelTo = id ? `/inspiration/${id}` : '/'

  const onDelete = async () => {
    if (!id || !user) return
    setBusy(true)
    setError(null)
    try {
      await deleteInspiration(id)
      navigate('/', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="stitch-shell stitch-shell--delete min-h-screen flex flex-col items-center justify-center p-md font-body-md">
        <p className="text-outline mb-4">请先登录</p>
        <Link to={`/login?redirect=${encodeURIComponent(`/delete-confirm?id=${id ?? ''}`)}`} className="text-primary underline">
          去登录
        </Link>
      </div>
    )
  }

  if (!id) {
    return (
      <div className="stitch-shell stitch-shell--delete min-h-screen flex flex-col items-center justify-center p-md font-body-md">
        <p className="text-error">缺少灵感 id</p>
        <Link to="/" className="mt-4 text-primary underline">
          回首页
        </Link>
      </div>
    )
  }

  return (
    <div className="stitch-shell stitch-shell--delete bg-background min-h-screen relative font-body-md text-on-surface overflow-hidden">
      <div className="fixed inset-0 paper-texture z-50" />

      <main className="p-margin-page h-screen w-full flex flex-col items-center justify-center bg-surface-bright relative z-10">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-md opacity-20 pointer-events-none rotate-[-1deg]">
          <div className="bg-surface-container p-md hand-drawn-border shadow-sm">
            <div className="h-4 w-24 bg-primary-container/20 mb-sm" />
            <div className="h-20 w-full bg-surface-variant rounded-sm mb-sm" />
            <div className="h-4 w-full bg-outline-variant/20 mb-xs" />
            <div className="h-4 w-2/3 bg-outline-variant/20" />
          </div>
          <div className="bg-white p-md hand-drawn-border shadow-sm rotate-2">
            <div className="h-32 w-full bg-secondary-container/10 mb-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-outline-variant text-4xl">image</span>
            </div>
            <div className="h-4 w-3/4 bg-outline-variant/20" />
          </div>
        </div>

        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-[2px] z-40 flex items-center justify-center p-md">
          <div className="relative w-full max-w-sm">
            <div
              className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-8 bg-primary-container/40 rotate-[-2deg] z-10 mix-blend-multiply opacity-80"
              style={{ clipPath: 'polygon(2% 0%, 98% 2%, 100% 100%, 0% 95%)' }}
            />
            <div className="bg-white torn-edge p-8 shadow-[10px_10px_0px_rgba(0,0,0,0.05)] relative z-0 transform rotate-1">
              <div className="flex flex-col items-center text-center space-y-md">
                <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center border-2 border-dashed border-error transform -rotate-3">
                  <span className="material-symbols-outlined text-error text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    delete_forever
                  </span>
                </div>
                <div className="space-y-sm">
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">Confirm Removal</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Are you sure you want to delete this inspiration? This action is irreversible!
                  </p>
                </div>
                {error ? <p className="text-error text-label-sm">{error}</p> : null}
                <div className="w-full flex justify-center py-xs">
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-outline-variant text-xs">star</span>
                    <span className="material-symbols-outlined text-outline-variant text-xs">star</span>
                    <span className="material-symbols-outlined text-outline-variant text-xs">star</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-sm w-full">
                  <Link
                    to={cancelTo}
                    className="flex-1 px-md py-sm font-label-sm text-label-sm text-secondary border-2 border-secondary/40 rounded-full hover:bg-secondary-container/20 transition-all active:scale-95 order-2 sm:order-1 text-center no-underline inline-flex items-center justify-center"
                  >
                    Cancel
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    disabled={busy}
                    className="flex-1 px-md py-sm font-label-sm text-label-sm bg-error text-on-error rounded-full hover:rotate-1 hover:scale-105 transition-all shadow-[4px_4px_0px_#93000a] active:translate-y-[2px] active:shadow-none order-1 sm:order-2 disabled:opacity-50"
                  >
                    {busy ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
              <div className="absolute bottom-4 right-4 opacity-20">
                <span className="material-symbols-outlined text-on-surface select-none">edit_off</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 w-full h-32 bg-stone-100 z-10 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-lime-100/30 wavy-footer" />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-lg opacity-40">
          <span className="material-symbols-outlined text-primary">potted_plant</span>
          <span className="material-symbols-outlined text-primary">edit</span>
          <span className="material-symbols-outlined text-primary">coffee</span>
        </div>
      </footer>

      <div className="fixed top-12 left-12 -rotate-6 pointer-events-none opacity-10 z-[5]">
        <img
          alt=""
          className="w-48 h-64 object-cover rounded-sm border-4 border-white shadow-lg"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAuSuTmXXFP4Irrpb1ryFJ91S1tM4kuIt9rDpevlkVct_TISS1xmiI3_QjbqCarDqFAoY2qnXxrHjIABwKUc6_1u_SX8zW_-LiGahKNlPrQHupVNZ8t-aL6OQe6Cbg_1Lh1EO_LkbfS0TEZK537TzVh4OXjYoxw_fApHqHu59jXVW7ORRZmPlPW0829fA0O-dT1tFCP92LUZhMFuBJnz95BM3NMhGmgUK0H1QNmhYN7bUNUBcCLD10HY61ySNDY40sNitaV2N4qpzU"
        />
      </div>
    </div>
  )
}

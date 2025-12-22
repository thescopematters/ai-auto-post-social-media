import { Check, Star, Shield, Upload, Sparkles, Crown } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient, paymentApi } from '../lib/apiClient';

interface CreateOrderResponse {
  redirectUrl?: string;
  data?: {
    redirectUrl?: string;
  };
}

interface CheckStatusResponse {
  success: boolean;
  message?: string;
  data?: {
    status?: string;
    transactionId?: string;
    merchantOrderId?: string;
    amount?: number;
    paymentMode?: string;
    paymentDetails?: {
      paymentMode?: string;
      transactionId?: string;
      timestamp?: number;
      amount?: number;
      state?: string;
    }[];
  };
}

interface PaymentHistoryItem {
  id: string;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  status: string;
  payment_method: string;
  phonepe_reference_id?: string;
  merchant_transaction_id?: string;
}


export function Subscription() {
  const [loading, setLoading] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [resultOpen, setResultOpen] = useState<boolean>(false);
  const [resultStatus, setResultStatus] = useState<'success' | 'failed' | null>(null);
  const [resultMessage, setResultMessage] = useState<string>('');
  const [resultInfo, setResultInfo] = useState<{
    transactionId?: string;
    orderId?: string;
    amount?: number;
    paymentMode?: string;
    timestamp?: string;
  }>({});



  // ✅ Use ref to track which transactions we've already verified
  const verifiedTransactions = useRef<Set<string>>(new Set());

  const ITEMS_PER_PAGE = 10;

  // 🧾 Fetch payment history


  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await paymentApi.getHistory();
      if (res?.success && Array.isArray(res.data)) {
        setHistory(res.data as PaymentHistoryItem[]);
        setTotalPages(Math.ceil(res.data.length / ITEMS_PER_PAGE));
        setPage(1);
      } else {
        setHistory([]);
        setTotalPages(1);
      }
    } catch (err: unknown) {
      console.error('Failed to load payment history', err);
      toast.error('Failed to load payment history');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    // Load history on mount
    fetchHistory();


    // Check for payment verification in URL
    const params = new URLSearchParams(window.location.search);
    const merchantTransactionId = params.get('merchantTransactionId');

    // ✅ Exit early if no transaction ID
    if (!merchantTransactionId) return;

    // ✅ Exit if we've already verified this transaction
    if (verifiedTransactions.current.has(merchantTransactionId)) {
      console.log('Already verified:', merchantTransactionId);
      return;
    }

    // ✅ Mark this transaction as being verified
    verifiedTransactions.current.add(merchantTransactionId);

    // ✅ Clean URL immediately to prevent re-trigger on back/forward navigation
    const url = new URL(window.location.href);
    url.searchParams.delete('merchantTransactionId');
    window.history.replaceState({}, '', url.toString());

    // ✅ Show toast only once
    toast('Verifying payment...', { icon: '🔎' });

    // ✅ Make the API call
    paymentApi
      .checkStatus(merchantTransactionId)
      .then((res: CheckStatusResponse) => {
        console.log('[checkStatus] raw response:', res);

        const anyRes = res as any;
        const payload = anyRes?.data?.data ?? anyRes?.data ?? anyRes;

        console.log('[checkStatus] payload:', payload);

        const successFlag = typeof anyRes?.success === 'boolean' ? anyRes.success : payload?.success ?? true;

        if (!successFlag) {
          console.warn('[checkStatus] success flag false:', anyRes);
          toast.error(anyRes?.message || 'Failed to verify payment (server returned failure).');
          return;
        }

        const data = payload?.data ?? payload;

        console.log('[checkStatus] normalized data:', data);

        const paymentDetail = data?.paymentDetails?.[0] ?? data?.paymentDetails;
        const pd = Array.isArray(paymentDetail) ? paymentDetail[0] : paymentDetail;

        const statusValue =
          (typeof data?.status === 'string' && data.status.toUpperCase?.()) ||
          (typeof pd?.state === 'string' && pd.state.toUpperCase?.()) ||
          'FAILED';

        console.log('[checkStatus] statusValue:', statusValue, 'paymentDetail:', pd);

        const isSuccess = statusValue === 'COMPLETED' || statusValue === 'SUCCESS';

        setResultStatus(isSuccess ? 'success' : 'failed');
        setResultMessage(isSuccess ? 'Payment completed successfully.' : 'Payment failed. Please try again.');

        setResultInfo({
          transactionId: pd?.transactionId || data?.transactionId,
          orderId: data?.merchantOrderId || data?.merchant_transaction_id || data?.orderId,
          amount: pd?.amount || data?.amount,
          paymentMode: pd?.paymentMode || data?.paymentMode || data?.payment_method,
          timestamp: pd?.timestamp ? new Date(pd.timestamp).toLocaleString() : undefined,
        });

        setResultOpen(true);

        if (isSuccess) {
          fetchHistory();
          toast.success('Payment verified successfully');
        } else {
          toast.error('Payment verification failed');
        }
      })
      .catch((err: unknown) => {
        console.error('[checkStatus] error:', err);
        toast.error('Error verifying payment');

        // ✅ Remove from verified set on error so user can retry
        verifiedTransactions.current.delete(merchantTransactionId);
      });
  }, []); // ✅ Empty dependency array - runs only once on mount

  // 💳 Handle Upgrade Click
  const handleUpgradeClick = async (selectedPlan: string) => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await apiClient.post<CreateOrderResponse>('/payment/createorder', {
        plan: selectedPlan,
        amount: 399
      });

      console.log('createOrder response:', res);

      const redirectUrl = res.redirectUrl ?? res.data?.redirectUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      toast.error('Payment link not received. Please try again.');
    } catch (error: any) {
      console.error('Failed to create order:', error);
      toast.error('Failed to initiate subscription payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFormattedDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  }


  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Subscription Plans */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upgrade your plan</h1>
        <p className="text-gray-600 mt-1">Choose the plan that fits your workflow.</p>
      </div>



      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Free</h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900">₹0</span>
            <span className="text-sm text-gray-500">INR / month</span>
          </div>
          <p className="mt-3 text-sm text-gray-600">Intelligence for everyday tasks</p>
          <button disabled className="mt-5 w-full py-2.5 rounded-lg bg-gray-100 text-gray-500 font-medium cursor-default">
            Your current plan
          </button>
          <ul className="mt-6 space-y-3 text-sm">
            <Feature text="Access to GPT-5" />
            <Feature text="Limited file uploads (2 posts per week)" icon={<Upload className="w-4 h-4" />} />
            <Feature text="Limited and slower image generation" icon={<Sparkles className="w-4 h-4" />} />
            <Feature text="Limited memory and context" icon={<Shield className="w-4 h-4" />} />
            <Feature text="Limited deep research" icon={<Star className="w-4 h-4" />} />
          </ul>
        </div>

        {/* Pro Plan */}
        <div className="bg-white border border-blue-200 rounded-2xl p-6 shadow-sm relative">
          <div className="absolute -top-3 right-4 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">NEW</div>
          <h2 className="text-lg font-semibold text-gray-900">Pro</h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900">₹399</span>
            <span className="text-sm text-gray-500">INR / month (inclusive of GST)</span>
          </div>
          <p className="mt-3 text-sm text-gray-600">More access to popular features</p>

          <button
            onClick={() => handleUpgradeClick('Pro Plan')}
            disabled={loading}
            className="mt-5 w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Crown className="w-4 h-4" /> {loading ? 'Preparing...' : 'Upgrade to Go'}
          </button>

          <ul className="mt-6 space-y-3 text-sm">
            <Feature text="Expanded access to GPT-5" />
            <Feature text="Unlimited posts publish/scheduling" />
            <Feature text="Expanded messaging and uploads" icon={<Upload className="w-4 h-4" />} />
            <Feature text="Expanded and faster image creation" icon={<Sparkles className="w-4 h-4" />} />
            <Feature text="Longer memory and context" icon={<Shield className="w-4 h-4" />} />
            <Feature text="Limited deep research" icon={<Star className="w-4 h-4" />} />
          </ul>

          <p className="mt-4 text-xs text-gray-500">Only available in certain regions. Limits apply.</p>
        </div>
      </div>

      {/* Payment History */}
      <div className="mt-10 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment history</h2>

        {historyLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-500">No payments found yet.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm table-fixed">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-4 w-1/5">Start Date</th>
                    <th className="py-2 pr-4 w-1/5">End Date</th>
                    <th className="py-2 pr-4 w-1/5">Amount</th>
                    <th className="py-2 pr-4 w-1/5">Status</th>
                    <th className="py-2 pr-4 w-1/5">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                    .map((t) => {
                      const referenceId = t.phonepe_reference_id || t.merchant_transaction_id;

                      return (
                        <tr key={t.id} className="border-t border-gray-100">
                          <td className="py-2 pr-4 w-1/5">{getFormattedDate(t.created_at)}</td>
                          <td className="py-2 pr-4 w-1/5">{getFormattedDate(t.period_end)}</td>
                          <td className="py-2 pr-4 w-1/5">₹{Number(t.amount).toFixed(2)}</td>
                          <td className="py-2 pr-4 w-1/5">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${t.status === 'SUCCESS' || t.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700'
                                : t.status === 'PENDING'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : t.status === 'FAILED'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td
                            className="py-2 pr-4 w-1/5 relative group"
                          >
                            <span className="truncate block" >
                              {referenceId}
                            </span>
                            {referenceId && (
                              <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 
                                                    bg-gray-800 text-white text-xs rounded py-1 px-2 
                                                    opacity-0 group-hover:opacity-100 transition-opacity 
                                                    pointer-events-none whitespace-nowrap z-10 shadow-lg">
                                {referenceId}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50">
                Previous
              </button>
              <span className="px-2 py-1 text-gray-700">
                {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50">
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Payment Result Modal */}
      {resultOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setResultOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="mb-2 text-lg font-semibold text-gray-900">{resultStatus === 'success' ? '✅ Payment Successful' : '❌ Payment Failed'}</div>
            <div className="text-sm text-gray-600 mb-3">{resultMessage}</div>

            {(resultInfo.transactionId || resultInfo.amount || resultInfo.orderId) && (
              <div className="border rounded-lg bg-gray-50 p-3 text-sm mb-3">
                {resultInfo.transactionId && (
                  <div className="flex justify-between">
                    <span>Transaction ID:</span>
                    <span className="font-medium text-gray-900">{resultInfo.transactionId}</span>
                  </div>
                )}
                {resultInfo.orderId && (
                  <div className="flex justify-between mt-1">
                    <span>Order ID:</span>
                    <span className="font-medium text-gray-900">{resultInfo.orderId}</span>
                  </div>
                )}
                {resultInfo.amount !== undefined && (
                  <div className="flex justify-between mt-1">
                    <span>Amount:</span>
                    <span className="font-medium text-gray-900">₹{resultInfo.amount.toFixed(2)}</span>
                  </div>
                )}
                {resultInfo.paymentMode && (
                  <div className="flex justify-between mt-1">
                    <span>Payment Mode:</span>
                    <span className="font-medium text-gray-900">{resultInfo.paymentMode}</span>
                  </div>
                )}
                {resultInfo.timestamp && (
                  <div className="flex justify-between mt-1">
                    <span>Timestamp:</span>
                    <span className="font-medium text-gray-900">{resultInfo.timestamp}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-4">
              {resultStatus === 'success' ? (
                <button onClick={() => setResultOpen(false)} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
                  Continue
                </button>
              ) : (
                <>
                  <button onClick={() => setResultOpen(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200">
                    Close
                  </button>
                  <button onClick={() => handleUpgradeClick('Pro Plan')} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                    Try again
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-gray-700">
      <span className="mt-0.5 text-green-600">
        <Check className="w-4 h-4" />
      </span>
      <div className="flex-1 flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span>{text}</span>
      </div>
    </li>
  );
}

export default Subscription;

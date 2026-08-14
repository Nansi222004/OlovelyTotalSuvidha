import { useState, useEffect } from 'react';
import {
  getSellerReviews,
  getSellerReviewStats,
  SellerReview,
  SellerReviewStats,
} from '../../../services/api/sellerReviewService';
import StarRating from '../../../components/ui/StarRating';

export default function SellerReviews() {
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [stats, setStats] = useState<SellerReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [reviewsRes, statsRes] = await Promise.all([
          getSellerReviews({ page, limit }),
          page === 1 ? getSellerReviewStats() : Promise.resolve(null),
        ]);

        if (reviewsRes.success && reviewsRes.data) {
          setReviews(reviewsRes.data.reviews || []);
          setPages(reviewsRes.data.pagination?.pages || 1);
          setTotal(reviewsRes.data.pagination?.total || 0);
        }

        if (statsRes && statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            err.message ||
            'Failed to load reviews'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page]);

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">
          Ratings & Reviews
        </h1>
        <p className="text-neutral-600 mt-1">
          View customer ratings and reviews for your products
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">
              Average Rating
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-neutral-900">
                {stats.avgRating.toFixed(1)}
              </span>
              <StarRating
                rating={stats.avgRating}
                showCount={false}
                size="md"
              />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">
              Total Reviews
            </p>
            <p className="text-2xl font-bold text-neutral-900">
              {stats.totalReviews}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm sm:col-span-2">
            <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">
              Rating Breakdown
            </p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.breakdown?.[star] || 0;
                const pct =
                  stats.totalReviews > 0
                    ? Math.round((count / stats.totalReviews) * 100)
                    : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-sm">
                    <span className="w-8 text-neutral-600">{star}★</span>
                    <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-neutral-500 text-xs">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">{error}</div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            No reviews yet for your products.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">
                      Product
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">
                      Rating
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">
                      Review
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-600 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reviews.map((review) => (
                    <tr key={review._id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-neutral-100 overflow-hidden flex-shrink-0">
                            {review.product?.mainImage ? (
                              <img
                                src={review.product.mainImage}
                                alt={review.product.productName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                                —
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium text-neutral-900 line-clamp-2">
                            {review.product?.productName || 'Product'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-700">
                        {review.customer?.name || 'Customer'}
                      </td>
                      <td className="py-3 px-4">
                        <StarRating
                          rating={review.rating}
                          showCount={false}
                          size="sm"
                        />
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        {review.title && (
                          <p className="text-sm font-medium text-neutral-800">
                            {review.title}
                          </p>
                        )}
                        <p className="text-sm text-neutral-600 line-clamp-2">
                          {review.comment || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-600 whitespace-nowrap">
                        {formatDate(review.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
                <p className="text-sm text-neutral-600">
                  Showing page {page} of {pages} ({total} reviews)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg disabled:opacity-40 hover:bg-neutral-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg disabled:opacity-40 hover:bg-neutral-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

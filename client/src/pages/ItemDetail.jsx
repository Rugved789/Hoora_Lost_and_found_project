import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth, SignedIn } from '../auth/clerk';
import { apiRequest, createAuthRequest } from '../utils/api';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    loadItem();
  }, [id]);

  async function loadItem() {
    try {
      const data = await apiRequest(`/api/items/${id}`);
      setItem(data.item);
    } catch (error) {
      console.error('Failed to load item:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus) {
    setUpdating(true);
    setStatusMessage('');
    try {
      const api = createAuthRequest(getToken);
      await api(`/api/items/${id}/status`, {
        method: 'PATCH',
        body: { status: newStatus }
      });
      setStatusMessage(`Status updated to ${newStatus}`);
      await loadItem();
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  }

  async function confirmReceived() {
    setUpdating(true);
    setStatusMessage('');
    try {
      const api = createAuthRequest(getToken);
      const res = await api(`/api/items/${id}/confirm-received`, {
        method: 'POST'
      });
      setStatusMessage(res.message || 'Receipt confirmed and karma awarded to finder!');
      await loadItem();
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!item) {
    return <div className="text-center py-12">Item not found</div>;
  }

  return (
    <div>
      <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Feed
      </Link>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-start justify-between mb-4">
          <span
            className={`px-3 py-1 text-sm font-semibold rounded ${
              item.type === 'lost'
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {item.type.toUpperCase()}
          </span>
          <span
            className={`px-3 py-1 text-sm font-medium rounded ${
              item.status === 'open'
                ? 'bg-blue-100 text-blue-800'
                : item.status === 'returned'
                ? 'bg-emerald-100 text-emerald-800'
                : item.status === 'claimed'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {item.status.toUpperCase()}
          </span>
        </div>

        <h1 className="text-3xl font-bold mb-4">{item.title}</h1>

        {/* Display image for lost item, or verified photo notice for found item */}
        {item.type === 'lost' && item.image_url && (
          <div className="mb-6">
            <img
              src={item.image_url}
              alt={item.title}
              className="max-h-72 rounded-lg object-cover border"
            />
          </div>
        )}

        {item.type === 'found' && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            🔒 {item.has_image ? 'Image verified by finder' : 'No photo uploaded'} — image is hidden to ensure only the true owner can describe it during verification.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <span className="text-gray-600 text-sm">Category:</span>
            <p className="font-medium capitalize">{item.category}</p>
          </div>
          <div>
            <span className="text-gray-600 text-sm">Color:</span>
            <p className="font-medium capitalize">{item.color}</p>
          </div>
          {item.brand && item.brand !== 'unknown' && (
            <div>
              <span className="text-gray-600 text-sm">Brand:</span>
              <p className="font-medium">{item.brand}</p>
            </div>
          )}
        </div>

        {item.description && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-gray-700">{item.description}</p>
          </div>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4 mb-6">
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              📍 <span className="font-medium">{item.location_name}</span>
            </div>
            <div>
              🕐{' '}
              <span className="font-medium">
                {new Date(item.happened_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-4 p-3 bg-gray-100 rounded text-sm font-medium">
            {statusMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {item.type === 'found' && (item.status === 'open' || item.status === 'at_desk') && (
            <Link
              to={`/items/${id}/claim`}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
            >
              Claim This Item
            </Link>
          )}

          {item.type === 'lost' && (
            <Link
              to={`/items/${id}/matches`}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              View Potential Matches
            </Link>
          )}

          {/* Status workflow transitions for finder/admin */}
          <SignedIn>
            {item.status === 'open' && (
              <button
                onClick={() => updateStatus('at_desk')}
                disabled={updating}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 text-sm"
              >
                Move to Desk
              </button>
            )}
            {item.status === 'at_desk' && (
              <button
                onClick={() => updateStatus('claimed')}
                disabled={updating}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                Mark Claimed
              </button>
            )}
            {item.status === 'claimed' && (
              <button
                onClick={() => updateStatus('returned')}
                disabled={updating}
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 text-sm"
              >
                Mark Returned
              </button>
            )}
            {(item.status === 'claimed' || item.status === 'returned') && (
              <button
                onClick={confirmReceived}
                disabled={updating}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
              >
                Confirm Received (Owner Only → +10 Karma)
              </button>
            )}
          </SignedIn>
        </div>
      </div>
    </div>
  );
}

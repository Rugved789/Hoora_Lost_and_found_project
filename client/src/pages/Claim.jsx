import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from '../auth/clerk';
import { createAuthRequest } from '../utils/api';

export default function Claim() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const [step, setStep] = useState('start'); // start, questions, result
  const [claimId, setClaimId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState(['', '', '']);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startClaim() {
    setLoading(true);
    setError('');

    try {
      const api = createAuthRequest(getToken);
      const data = await api(`/api/items/${id}/claim/start`, {
        method: 'POST'
      });

      setClaimId(data.claim_id);
      setQuestions(data.questions);
      setAttemptsLeft(data.attempts_left);
      setStep('questions');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswers() {
    setLoading(true);
    setError('');

    try {
      const api = createAuthRequest(getToken);
      const data = await api(`/api/claims/${claimId}/answer`, {
        method: 'POST',
        body: { answers }
      });

      setResult(data);
      setAttemptsLeft(data.attempts_left);
      setStep('result');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <SignedOut>
        <div className="text-center py-12">
          <p className="text-lg mb-4">Please sign in to claim an item</p>
        </div>
      </SignedOut>

      <SignedIn>
        <Link
          to={`/items/${id}`}
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Back to Item
        </Link>

        <h1 className="text-3xl font-bold mb-6">Claim Item</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>
        )}

        {step === 'start' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="mb-4">
              To claim this item, you'll need to answer verification questions to
              prove you're the owner.
            </p>
            <p className="mb-6 text-sm text-gray-600">
              You have 3 attempts to pass the verification.
            </p>
            <button
              onClick={startClaim}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Starting...' : 'Start Claim Process'}
            </button>
          </div>
        )}

        {step === 'questions' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="mb-4">
              <span className="text-sm text-gray-600">
                Attempts left: {attemptsLeft}
              </span>
            </div>

            <div className="space-y-4 mb-6">
              {questions.map((question, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question {i + 1}: {question}
                  </label>
                  <textarea
                    value={answers[i]}
                    onChange={(e) => {
                      const newAnswers = [...answers];
                      newAnswers[i] = e.target.value;
                      setAnswers(newAnswers);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    rows="2"
                    placeholder="Your answer..."
                  />
                </div>
              ))}
            </div>

            <button
              onClick={submitAnswers}
              disabled={loading || answers.some((a) => !a.trim())}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Submitting...' : 'Submit Answers'}
            </button>
          </div>
        )}

        {step === 'result' && result && (
          <div className="bg-white p-6 rounded-lg shadow">
            {result.passed ? (
              <div>
                <h2 className="text-2xl font-bold text-green-600 mb-4">
                  ✓ Verification Passed!
                </h2>
                <p className="mb-4">Score: {result.score}/100</p>

                {result.finder && (
                  <div className="bg-green-50 p-4 rounded mb-4">
                    <h3 className="font-semibold mb-2">Contact the Finder:</h3>
                    <p>Name: {result.finder.name}</p>
                    <p>Email: {result.finder.email}</p>
                  </div>
                )}

                <Link
                  to="/profile"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-block"
                >
                  Go to Profile
                </Link>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-red-600 mb-4">
                  Verification Failed
                </h2>
                <p className="mb-4">Score: {result.score}/100 (need 70+)</p>

                {result.details && (
                  <div className="mb-4 space-y-2">
                    {result.details.map((detail, i) => (
                      <div key={i} className="bg-gray-50 p-3 rounded">
                        <div className="text-sm font-medium">
                          Question {i + 1}: {detail.score}/100
                        </div>
                        <div className="text-sm text-gray-600">
                          {detail.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {attemptsLeft > 0 ? (
                  <div>
                    <p className="mb-4">You have {attemptsLeft} attempts left.</p>
                    <button
                      onClick={() => {
                        setStep('questions');
                        setAnswers(['', '', '']);
                        setResult(null);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <p className="text-red-600">Maximum attempts reached.</p>
                )}
              </div>
            )}
          </div>
        )}
      </SignedIn>
    </div>
  );
}

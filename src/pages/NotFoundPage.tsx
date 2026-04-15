import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <h1 className="text-6xl font-bold text-indigo-500">404</h1>
        <p className="text-xl font-semibold text-gray-800 mt-4">
          Page Not Found
        </p>
        <p className="text-gray-500 mt-2">
          The page you are looking for does not exist.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}

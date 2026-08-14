import { useNavigate } from 'react-router-dom';

export default function SearchBar() {
  const navigate = useNavigate();

  const handleSearchClick = () => {
    navigate('/search');
  };

  return (
    <div className="px-4 mb-4">
      <div
        onClick={handleSearchClick}
        className="w-full bg-white rounded-xl shadow-sm border border-neutral-200 px-4 py-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
      >
        <span className="text-neutral-400 text-lg">🔍</span>
        <span className="flex-1 text-sm text-neutral-500">
          Search for atta, dal, coke and more
        </span>
      </div>
    </div>
  );
}



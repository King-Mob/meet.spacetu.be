import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Lobby() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => sessionStorage.getItem('meetjohn-name') ?? '');

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    sessionStorage.setItem('meetjohn-name', trimmed || 'guest');
    navigate('/call');
  };

  return (
    <div className="page">
      <main className="lobby">
        <h1>MeetJohn</h1>
        <form onSubmit={join}>
          <input
            autoFocus
            placeholder="your name"
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="primary">
            join the call
          </button>
        </form>
      </main>
    </div>
  );
}
